import { useEffect, useState, useCallback } from 'react';
import { fetchKBArticles, fetchKBMeta } from '../../services/ticketService';

const PRIORITY_STYLE = {
  P1: 'bg-rose-100 text-rose-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-amber-100 text-amber-700',
  P4: 'bg-slate-100 text-slate-600',
};

function PriorityBadge({ priority }) {
  if (!priority) return null;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_STYLE[priority] || 'bg-slate-100 text-slate-600'}`}>
      {priority}
    </span>
  );
}

function ArticleModal({ article, onClose }) {
  if (!article) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative mx-4 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-6 top-6 text-slate-400 hover:text-slate-600"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {article.ticket_ref && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-500">
              {article.ticket_ref}
            </span>
          )}
          <PriorityBadge priority={article.priority} />
          {article.category && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
              {article.category}
            </span>
          )}
        </div>

        <h2 className="mb-2 text-xl font-semibold text-slate-900">{article.title}</h2>

        {article.assigned_team && (
          <p className="mb-4 text-sm text-slate-500">Team: {article.assigned_team}</p>
        )}

        {article.description && (
          <div className="mb-5">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Problem Description</h3>
            <p className="text-sm text-slate-700">{article.description}</p>
          </div>
        )}

        <div className="rounded-2xl bg-emerald-50 p-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">Resolution</h3>
          <p className="text-sm leading-relaxed text-slate-800">{article.resolution}</p>
          {article.resolution_time && (
            <p className="mt-3 text-xs text-slate-400">Resolved in {article.resolution_time}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function KnowledgeBase() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 18;

  useEffect(() => {
    fetchKBMeta().then(({ categories: cats }) => {
      setCategories(cats || []);
    });
  }, []);

  const load = useCallback(async (pageNum = 0) => {
    setLoading(true);
    const result = await fetchKBArticles({
      category: selectedCategory || undefined,
      priority: selectedPriority || undefined,
      search: search || undefined,
      limit: PAGE_SIZE,
      offset: pageNum * PAGE_SIZE,
    });
    setArticles(result.articles);
    setTotal(result.articles.length < PAGE_SIZE && pageNum === 0 ? result.articles.length : (pageNum + 1) * PAGE_SIZE + (result.articles.length === PAGE_SIZE ? 1 : 0));
    setPage(pageNum);
    setLoading(false);
  }, [selectedCategory, selectedPriority, search]);

  useEffect(() => {
    load(0);
  }, [load]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const clearFilters = () => {
    setSearch('');
    setSearchInput('');
    setSelectedCategory('');
    setSelectedPriority('');
  };

  const hasFilters = search || selectedCategory || selectedPriority;

  return (
    <div className="space-y-6">
      {selectedArticle && (
        <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}

      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Knowledge Base</h2>
            <p className="mt-1 text-sm text-slate-500">
              200 resolved tickets — searchable resolution library for support teams.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search title, description, resolution…"
              className="w-72 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Search
            </button>
          </form>
        </div>

        {/* Category chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !selectedCategory
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name === selectedCategory ? '' : cat.name)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedCategory === cat.name
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name} <span className="opacity-60">({cat.count})</span>
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Priority:</span>
          {['P1', 'P2', 'P3', 'P4'].map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPriority(p === selectedPriority ? '' : p)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                selectedPriority === p
                  ? (PRIORITY_STYLE[p] || 'bg-slate-200 text-slate-700') + ' ring-2 ring-offset-1 ring-current'
                  : (PRIORITY_STYLE[p] || 'bg-slate-100 text-slate-600') + ' opacity-60 hover:opacity-100'
              }`}
            >
              {p}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-2 text-xs text-slate-400 underline hover:text-slate-600"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex h-48 items-center justify-center text-slate-400">Loading…</div>
        ) : articles.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-slate-400">No articles match your filters.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <button
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-md"
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <PriorityBadge priority={article.priority} />
                  {article.category && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                      {article.category}
                    </span>
                  )}
                  {article.ticket_ref && (
                    <span className="ml-auto font-mono text-xs text-slate-400">{article.ticket_ref}</span>
                  )}
                </div>

                <h3 className="mb-1.5 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
                  {article.title}
                </h3>

                {article.description && (
                  <p className="mb-2 line-clamp-2 text-xs text-slate-500">{article.description}</p>
                )}

                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="line-clamp-2 text-xs text-emerald-700">{article.resolution}</p>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{article.assigned_team || '—'}</span>
                  {article.resolution_time && <span>{article.resolution_time}</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && articles.length === PAGE_SIZE && (
          <div className="mt-6 flex justify-center gap-3">
            {page > 0 && (
              <button
                onClick={() => load(page - 1)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                ← Previous
              </button>
            )}
            <button
              onClick={() => load(page + 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default KnowledgeBase;
