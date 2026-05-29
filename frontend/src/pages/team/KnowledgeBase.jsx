function KnowledgeBase() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Knowledge base</h2>
        <p className="mt-2 text-slate-500">A curated workspace for runbooks, best practices and incident response templates.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Incident escalation', description: 'Follow the process for priority incident escalation.' },
            { title: 'Ticket handoff', description: 'Transition ownership between teams smoothly.' },
            { title: 'CSAT remediation', description: 'Improve customer satisfaction after a poor rating.' },
            { title: 'Workflow mapping', description: 'Use a secure change control procedure.' },
          ].map((item) => (
            <div key={item.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default KnowledgeBase;
