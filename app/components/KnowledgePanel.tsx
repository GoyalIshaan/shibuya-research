'use client';

import { useState } from 'react';
import { Search, FileText, Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';

type SearchResult = {
  chunkId: string;
  text: string;
  docTitle: string | null;
  docSource: string | null;
  docId: string | null;
  ingestedAt: string | null;
  score: number;
};

export default function KnowledgePanel() {
  // Text ingest state
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('upload');
  const [text, setText] = useState('');
  const [isIngestingText, setIsIngestingText] = useState(false);
  const [textIngestResult, setTextIngestResult] = useState<{ success: boolean; message: string } | null>(null);

  // PDF ingest state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isIngestingPdf, setIsIngestingPdf] = useState(false);
  const [pdfIngestResult, setPdfIngestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Search state
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState<string>('');

  const ingestText = async () => {
    setIsIngestingText(true);
    setTextIngestResult(null);
    try {
      const res = await fetch('/api/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'Untitled',
          source,
          text,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setTextIngestResult({
          success: false,
          message: json.error || 'Unknown error',
        });
        return;
      }

      setTextIngestResult({
        success: true,
        message: `Successfully ingested ${json.chunks} chunks${json.cached ? ' (cached)' : ''}`,
      });

      // Clear form on success
      setText('');
      setTitle('');
    } catch (e) {
      setTextIngestResult({
        success: false,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsIngestingText(false);
    }
  };

  const ingestPdf = async () => {
    if (!pdfFile) {
      setPdfIngestResult({
        success: false,
        message: 'Please select a PDF file',
      });
      return;
    }

    setIsIngestingPdf(true);
    setPdfIngestResult(null);
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);
      if (title) formData.append('title', title);
      if (source) formData.append('source', source);

      const res = await fetch('/api/knowledge/ingest-file', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setPdfIngestResult({
          success: false,
          message: json.error || 'Unknown error',
        });
        return;
      }

      setPdfIngestResult({
        success: true,
        message: `Successfully ingested ${json.chunks} chunks from PDF${json.cached ? ' (cached)' : ''}`,
      });

      // Clear form on success
      setPdfFile(null);
      setTitle('');
    } catch (e) {
      setPdfIngestResult({
        success: false,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsIngestingPdf(false);
    }
  };

  const search = async () => {
    setIsSearching(true);
    setSearchError('');
    setResults([]);
    try {
      const res = await fetch('/api/knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK: 8 }),
      });

      const json = await res.json();

      if (!res.ok) {
        setSearchError(json.error || `HTTP ${res.status}`);
        return;
      }

      setResults((json.results || []) as SearchResult[]);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Knowledge Base
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Upload documents for AI-powered semantic search
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Common Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Title
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Market Research Q4 2024"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source
            </label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g., notion, gdocs, upload"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Text Upload */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <FileText className="w-4 h-4" />
              Paste Text
            </div>
            <textarea
              className="w-full min-h-[160px] border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your document text here..."
            />
            <button
              onClick={ingestText}
              disabled={isIngestingText || !text.trim()}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isIngestingText ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Ingest Text
                </>
              )}
            </button>
            {textIngestResult && (
              <div
                className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                  textIngestResult.success
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {textIngestResult.success ? (
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <span>{textIngestResult.message}</span>
              </div>
            )}
          </div>

          {/* PDF Upload */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <Upload className="w-4 h-4" />
              Upload PDF
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="hidden"
                id="pdf-upload"
              />
              <label
                htmlFor="pdf-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {pdfFile ? pdfFile.name : 'Click to select PDF'}
                </span>
                <span className="text-xs text-gray-500">Text-based PDFs only</span>
              </label>
            </div>
            <button
              onClick={ingestPdf}
              disabled={isIngestingPdf || !pdfFile}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isIngestingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing PDF...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Ingest PDF
                </>
              )}
            </button>
            {pdfIngestResult && (
              <div
                className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                  pdfIngestResult.success
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {pdfIngestResult.success ? (
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <span>{pdfIngestResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="border-t pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <Search className="w-4 h-4" />
            Semantic Search
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isSearching && query.trim() && search()}
              placeholder="Search your documents..."
            />
            <button
              onClick={search}
              disabled={isSearching || !query.trim()}
              className="px-6 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </button>
          </div>

          {searchError && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
              <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3 mt-4">
              <div className="text-sm text-gray-600">
                Found {results.length} relevant chunks
              </div>
              {results.map((result) => (
                <div
                  key={result.chunkId}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {result.docTitle || 'Untitled'}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {result.docSource && (
                        <span className="px-2 py-1 bg-white rounded border border-gray-200">
                          {result.docSource}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                        {(result.score * 100).toFixed(1)}% match
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">
                    {result.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
