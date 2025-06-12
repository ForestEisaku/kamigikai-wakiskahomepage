// src/app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: '香美町議会アーカイブ',
  description: '一般質問のタイムスタンプと要約を投稿・検索できます',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <head />
      <body className="bg-gray-50 text-gray-800 font-sans antialiased">
        <header className="bg-white shadow-sm mb-6">
          <div className="max-w-5xl mx-auto px-4 py-4 text-center">
            <h1 className="text-2xl font-bold text-gray-700">
              香美町議会 一般質問アーカイブ
            </h1>
            <nav className="mt-2 space-x-6">
             
              
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4">{children}</main>
        <footer className="mt-10 text-center text-sm text-gray-500 py-6 border-t">
          &copy; {new Date().getFullYear()} 香美町議会気軽に見てみる化プロジェクト
        </footer>
      </body>
    </html>
  );
}