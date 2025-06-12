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

const GIKAI_NAMES = [
  '2025年6月定例会',
  '2025年3月定例会',
  '2024年12月定例会',
  '2024年9月定例会',
];

type Question = {
  id?: string;
  date: string;
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
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [gikaiName, setGikaiName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [videoMeta, setVideoMeta] = useState<{ title: string; publishedAt: string } | null>(null);
  const [previewLines, setPreviewLines] = useState<string[]>([]);
  const [urlError, setUrlError] = useState('');

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
        setUrlError('URLの形式が正しくありません。watch?v= が含まれている必要があります');
        return;
      }
      setUrlError('');
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

  const handlePreview = () => {
    const lines = rawInput.split('\n').filter(Boolean);
    setPreviewLines(lines);
  };

  const handleSubmit = async () => {
    if (!youtubeUrl.trim() || !rawInput.trim() || !gikaiName.trim()) {
      alert('必要な情報が入力されていません');
      return;
    }

    const lines = rawInput.split('\n').filter(Boolean);

    try {
      const batch = lines.map(async (line) => {
        const match = line.match(/^(\(?\d+:\d+\)?)\s*(.+)$/);
        if (!match) return;

        const [, timestamp, summary] = match;
        await addDoc(collection(db, 'questions'), {
          date: gikaiName,
          speaker: speaker || '（未入力）',
          summary,
          timestamp: timestamp.replace(/[()]/g, ''),
          youtubeUrl,
          title: videoMeta?.title || '',
          publishedAt: videoMeta?.publishedAt || '',
          createdAt: new Date(),
          author: user?.email || '',
        });
      });

      await Promise.all(batch);
      alert('保存しました');
      // フォームリセットは行わない（連続投稿を考慮）
      handlePreview();
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました');
    }
  };

  const handleClear = () => {
    setYoutubeUrl('');
    setSpeaker('');
    setRawInput('');
    setGikaiName('');
    setPreviewLines([]);
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

  const filtered = questions.filter((q) =>
    q.speaker.includes(query) ||
    q.date.includes(query) ||
    q.summary.includes(query)
  );

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">香美町議会 一般質問アーカイブ検索</h1>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="キーワード検索（例：吉川、キャッシュレス）"
        className="w-full border p-2 rounded"
      />

      <div className="space-y-2">
        {filtered.map((item) => (
          <div key={item.id} className="border p-3 rounded bg-white shadow-sm">
            <div className="text-sm text-gray-600">{item.date}｜{item.speaker}</div>
            <div className="text-md">
              <a
                href={formatYoutubeLink(item.youtubeUrl, item.timestamp)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                {item.timestamp}
              </a>
              ：{item.summary}
            </div>
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
        ))}
      </div>

      {user ? (
        <div className="bg-gray-100 p-4 rounded space-y-4 mt-10">
          <div className="text-right text-sm">
            ログイン中：{user.email}
            <button onClick={handleLogout} className="ml-4 text-blue-600 underline">
              ログアウト
            </button>
          </div>

          <h2 className="font-semibold text-lg">投稿フォーム（管理者専用）</h2>

          <input
            value={gikaiName}
            onChange={(e) => setGikaiName(e.target.value)}
            placeholder="議会名（例：2025年3月定例会）"
            list="gikai-list"
            className="w-full border p-2 rounded"
          />
          <datalist id="gikai-list">
            {GIKAI_NAMES.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>

          <input
            value={speaker}
            onChange={(e) => setSpeaker(e.target.value)}
            placeholder="発言者名を入力（例：吉川康治議員）"
            className="w-full border p-2 rounded"
          />

          <input
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="YouTube URL を入力"
            className="w-full border p-2 rounded"
          />
          {urlError && <div className="text-sm text-red-500">{urlError}</div>}
          {videoMeta && (
            <div className="text-sm text-gray-600">
              🎬 {videoMeta.title}（投稿日：{videoMeta.publishedAt.split('T')[0]}）
            </div>
          )}

          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            onBlur={handlePreview}
            placeholder={`タイムスタンプと要約を貼り付け（例）\n0:02 キャッシュレス対応の質問\n2:01 導入状況の回答`}
            rows={6}
            className="w-full border p-2 rounded"
          />

          <button onClick={handleSubmit} className="bg-green-600 text-white px-4 py-2 rounded">
            投稿（Firestoreに保存）
          </button>
          <button onClick={handleClear} className="ml-4 border border-gray-400 text-gray-600 px-4 py-2 rounded">
            全てクリア
          </button>

          {previewLines.length > 0 && (
            <div className="mt-4 border-t pt-2">
              <h3 className="font-semibold text-sm mb-2">投稿プレビュー</h3>
              {previewLines.map((line, idx) => (
                <div key={idx} className="text-sm text-gray-700">{line}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center">
          <button onClick={handleLogin} className="bg-blue-600 text-white px-4 py-2 rounded">
            Googleでログイン
          </button>
        </div>
      )}
    </main>
  );
}

