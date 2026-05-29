import AnalyticsCard from '../../components/analytics/AnalyticsCard';
import IncidentBanner from '../../components/analytics/IncidentBanner';

function AdminAnalytics() {
  return (
    <div className="space-y-6">
      <section className="grid gap-5 md:grid-cols-3">
        <AnalyticsCard title="Total tickets" value="120" description="Tickets processed by the incident system." />
        <AnalyticsCard title="CSAT average" value="4.4" description="Average satisfaction for resolved incidents." />
        <AnalyticsCard title="Team performance" value="89%" description="Resolution quality across measured teams." />
      </section>
      <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-3xl bg-white p-6 shadow-panel">
          <h2 className="text-xl font-semibold text-slate-900">Analytics overview</h2>
          <div className="mt-6 space-y-4 text-slate-600">
            <p>Track ticket volume, service level agreements, and team throughput from a single dashboard.</p>
            <p>Front-end architecture supports analytics expansion and chart integration in future phases.</p>
          </div>
        </div>
        <IncidentBanner
          title="Low satisfaction alert"
          message="A group of recent CSAT submissions fell below 3 stars. Review follow-up actions and escalation workflows."
        />
      </section>
    </div>
  );
}

export default AdminAnalytics;
