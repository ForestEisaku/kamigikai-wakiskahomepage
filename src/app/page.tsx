// src/app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
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
  const [query, setQuery] = useState('');
  const [meeting, setMeeting] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [videoMeta, setVideoMeta] = useState<{ title: string; publishedAt: string } | null>(null);
  const [previewEntries, setPreviewEntries] = useState<{ timestamp: string; summary: string }[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
  }, []);

  useEffect(() => {
    const fetchQuestions = async () => {
      const snapshot = await getDocs(collection(db, 'questions'));
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

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      newSet.has(id) ? newSet.delete(id) : newSet.add(id);
      return newSet;
    });
  };

  const formatYoutubeLink = (url: string, timestamp: string) => {
    const [min, sec] = timestamp.split(':').map(Number);
    const seconds = min * 60 + sec;
    return `${url}&t=${seconds}s`;
  };

  const filtered = questions.filter((q) =>
    q.speaker.includes(query) ||
    q.date.includes(query) ||
    q.summary.includes(query) ||
    q.meeting?.includes(query)
  );

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-center">香美町議会 一般質問アーカイブ検索</h1>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="キーワード検索（例：吉川、キャッシュレス、2025年3月定例会）"
        className="w-full border p-2 rounded"
      />

      <div className="space-y-2">
        {filtered.map((item) => {
          const isExpanded = expandedIds.has(item.id || '');
          const summaryLines = item.summary.split('\n');
          const shortSummary = summaryLines.slice(0, 2).join('\n');
          const remaining = summaryLines.length > 2;

          return (
            <div key={item.id} className="border p-3 rounded bg-white shadow-sm">
              <div className="text-sm text-gray-600">{item.date}｜{item.meeting}｜{item.speaker}</div>
              <div className="text-md whitespace-pre-line">
                <a
                  href={formatYoutubeLink(item.youtubeUrl, item.timestamp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  {item.timestamp}
                </a>
                ：{isExpanded || !remaining ? item.summary : shortSummary}
              </div>
              {remaining && (
                <button
                  onClick={() => handleToggleExpand(item.id || '')}
                  className="text-sm text-blue-600 underline mt-1"
                >
                  {isExpanded ? '閉じる' : 'もっと見る'}
                </button>
              )}
              {item.title && (
                <div className="text-xs text-gray-500 mt-1">🎬 {item.title}（投稿日：{item.publishedAt?.split('T')[0]}）</div>
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
          );
        })}
      </div>
    </main>
  );
}

