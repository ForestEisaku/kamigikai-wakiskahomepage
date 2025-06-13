// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, query as firestoreQuery, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  User,
} from 'firebase/auth';

const pastMeetings = [
  '2025年6月定例会',
  '2025年3月定例会',
  '2024年12月定例会',
  '2024年9月定例会',
  '2024年6月定例会',
  '2024年3月定例会'
];

type Question = {
  id?: string;
  date: string;
  meeting: string;
  questioner: string;
  speaker: string;
  summary: string;
  timestamp: string;
  youtubeUrl: string;
  title?: string;
  publishedAt?: string;
  author?: string;
};

export default function ArchivePage() {
  const [user, setUser] = useState<User | null>(null);
  const [meeting, setMeeting] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [questioner, setQuestioner] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [videoMeta, setVideoMeta] = useState<{ title: string; publishedAt: string } | null>(null);
  const [previewEntries, setPreviewEntries] = useState<{ timestamp: string; summary: string }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
  }, []);

  useEffect(() => {
    const fetchQuestions = async () => {
      const q = firestoreQuery(collection(db, 'questions'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Question[];
      setQuestions(data);
    };
    fetchQuestions();
  }, []);

  useEffect(() => {
    const fetchVideoMeta = async () => {
      if (!youtubeUrl.includes('watch?v=')) {
        setVideoMeta(null);
        return;
      }
      const videoId = new URLSearchParams(new URL(youtubeUrl).search).get('v');
      if (!videoId) return;

      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${process.env.NEXT_PUBLIC_YOUTUBE_API_KEY}`
        );
        const json = await res.json();
        if (json.items && json.items.length > 0) {
          const snippet = json.items[0].snippet;
          setVideoMeta({ title: snippet.title, publishedAt: snippet.publishedAt });
        }
      } catch (err) {
        console.error('YouTube API error:', err);
        setVideoMeta(null);
      }
    };

    fetchVideoMeta();
  }, [youtubeUrl]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleSubmit = async () => {
    if (!youtubeUrl.trim() || !rawInput.trim() || !meeting.trim()) {
      alert('YouTube URL・議会名・要約を入力してください');
      return;
    }

    const lines = rawInput.split('\n').map(l => l.trim());
    const entries: { timestamp: string; summary: string }[] = [];

    let current: { timestamp: string; summary: string } | null = null;

    for (const line of lines) {
      const match = line.match(/^(\(?\d+:\d+\)?)[\s　]*(.+)$/);
      if (match) {
        if (current) entries.push(current);
        current = {
          timestamp: match[1].replace(/[()]/g, ''),
          summary: match[2]
        };
      } else if (current) {
        current.summary += '\n' + line;
      }
    }
    if (current) entries.push(current);

    try {
      const batch = entries.map(async (entry) => {
        await addDoc(collection(db, 'questions'), {
          date: new Date().toISOString().split('T')[0],
          meeting,
          speaker: speaker || '（未入力）',
          questioner: questioner || '（未入力）',
          summary: entry.summary,
          timestamp: entry.timestamp,
          youtubeUrl,
          title: videoMeta?.title || '',
          publishedAt: videoMeta?.publishedAt || '',
          createdAt: new Date(),
          author: user?.email || '',
        });
      });

      await Promise.all(batch);
      alert('保存しました');
      setPreviewEntries([]);
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    }
  };

  const handleClear = () => {
    setSpeaker('');
    setRawInput('');
    setPreviewEntries([]);
  };

  const handlePreview = () => {
    const lines = rawInput.split('\n').map(l => l.trim());
    const entries: { timestamp: string; summary: string }[] = [];

    let current: { timestamp: string; summary: string } | null = null;

    for (const line of lines) {
      const match = line.match(/^(\(?\d+:\d+\)?)[\s　]*(.+)$/);
      if (match) {
        if (current) entries.push(current);
        current = {
          timestamp: match[1].replace(/[()]/g, ''),
          summary: match[2]
        };
      } else if (current) {
        current.summary += '\n' + line;
      }
    }
    if (current) entries.push(current);
    setPreviewEntries(entries);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この投稿を削除しますか？')) return;
    await deleteDoc(doc(db, 'questions', id));
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const formatYoutubeLink = (url: string, timestamp: string) => {
    const [min, sec] = timestamp.split(':').map(Number);
    const seconds = min * 60 + sec;
    return `${url}&t=${seconds}s`;
  };

  const filteredQuestions = questions.filter(q => {
    const term = searchTerm.toLowerCase();
    return (
      q.questioner.toLowerCase().includes(term) ||
      q.speaker.toLowerCase().includes(term) ||
      q.summary.toLowerCase().includes(term)
    );
  });

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">香美町一般質問アーカイブ（脇坂英作 開発・運営）</h1>
      </div>

      <div className="mt-4">
        <input
          type="text"
          placeholder="キーワードで検索（質問者・発言者・要約）"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full border p-2 rounded"
        />
      </div>

      <div className="space-y-4">
        {filteredQuestions.map((item) => (
          <div key={item.id} className="border p-3 rounded bg-white shadow-sm">
            <div className="text-sm text-gray-600">
              {item.date}｜{item.meeting}｜{item.questioner}｜{item.speaker}
            </div>
            <div className="text-md whitespace-pre-line">
              <a
                href={formatYoutubeLink(item.youtubeUrl, item.timestamp)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {item.timestamp}
              </a>
              ：
              {item.summary.length > 50 && expandedId !== item.id
                ? item.summary.slice(0, 50) + '...'
                : item.summary}
            </div>
            {item.summary.length > 50 && (
              <button
                className="text-blue-500 text-sm underline mt-1"
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id!)}
              >
                {expandedId === item.id ? '閉じる' : 'もっと見る'}
              </button>
            )}
            {item.title && (
              <div className="text-xs text-gray-500 mt-1">
                🎬 {item.title}（投稿日：{item.publishedAt?.split('T')[0]}）
              </div>
            )}
            {user?.email === item.author && (
              <button
                onClick={() => item.id && handleDelete(item.id)}
                className="text-red-600 text-sm underline mt-1"
              >
                削除
              </button>
            )}
          </div>
        ))}

        {user ? (
          <>
            <div className="space-y-2">
              <select
                value={meeting}
                onChange={(e) => setMeeting(e.target.value)}
                className="w-full border p-2 rounded"
              >
                <option value="">何年何月定例会か選択</option>
                {pastMeetings.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="YouTube URL"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full border p-2 rounded"
              />
              <input
                type="text"
                placeholder="質問者名"
                value={questioner}
                onChange={(e) => setQuestioner(e.target.value)}
                className="w-full border p-2 rounded"
              />
              <input
                type="text"
                placeholder="発言者名"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                className="w-full border p-2 rounded"
              />
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="タイムスタンプと要約（例: 0:15 発言内容）"
                className="w-full border p-2 rounded h-40"
              />
              <div className="flex space-x-2">
                <button onClick={handlePreview} className="bg-blue-500 text-white px-4 py-2 rounded">
                  プレビュー
                </button>
                <button onClick={handleSubmit} className="bg-green-500 text-white px-4 py-2 rounded">
                  保存
                </button>
                <button onClick={handleClear} className="bg-gray-300 text-black px-4 py-2 rounded">
                  クリア
                </button>
                <button onClick={handleLogout} className="text-red-500 underline px-4 py-2">
                  ログアウト
                </button>
              </div>
            </div>
            <div>
              {previewEntries.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h2 className="font-semibold">プレビュー一覧</h2>
                  {previewEntries.map((entry, idx) => (
                    <div key={idx} className="border p-2 rounded">
                      <div className="text-sm font-bold">{entry.timestamp}</div>
                      <div className="whitespace-pre-line text-sm">{entry.summary}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center">
            <button
              onClick={handleLogin}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Googleでログイン
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

