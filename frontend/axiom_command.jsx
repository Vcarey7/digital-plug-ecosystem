import React, { useState } from 'react';

// AXIOM Command Center — Digital Plug Co.
// Central dashboard for managing all AXIOM agent operations

const AgentCard = ({ name, status, lastRun, tasksCompleted }) => (
  <div style={{ background: '#1a1a2e', border: '1px solid #16213e', borderRadius: 8, padding: 16, marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3 style={{ color: '#e94560', margin: 0 }}>{name}</h3>
      <span style={{ background: status === 'active' ? '#00b894' : '#636e72', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>{status}</span>
    </div>
    <p style={{ color: '#a29bfe', margin: '8px 0 0' }}>Last Run: {lastRun}</p>
    <p style={{ color: '#dfe6e9', margin: '4px 0 0' }}>Tasks Completed: {tasksCompleted}</p>
  </div>
);

const AXIOM_AGENTS = [
  { name: 'SCOUT', status: 'active', lastRun: '2 min ago', tasksCompleted: 142 },
  { name: 'WRITER', status: 'active', lastRun: '5 min ago', tasksCompleted: 89 },
  { name: 'CLOSER', status: 'active', lastRun: '1 min ago', tasksCompleted: 34 },
  { name: 'OPERATOR', status: 'active', lastRun: 'now', tasksCompleted: 201 },
  { name: 'ARCHIVIST', status: 'idle', lastRun: '1 hr ago', tasksCompleted: 67 },
  { name: 'ADVISOR', status: 'active', lastRun: '10 min ago', tasksCompleted: 55 },
];

export default function AXIOMCommand() {
  const [activeTab, setActiveTab] = useState('agents');

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#fff', fontFamily: 'Inter, sans-serif', padding: 32 }}>
      <h1 style={{ color: '#e94560', letterSpacing: 2, marginBottom: 4 }}>AXIOM COMMAND CENTER</h1>
      <p style={{ color: '#636e72', marginBottom: 32 }}>Digital Plug Co. — Autonomous Agent Operations</p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {['agents', 'pipelines', 'logs'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ background: activeTab === tab ? '#e94560' : '#1a1a2e', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 700 }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'agents' && (
        <div>
          <h2 style={{ color: '#a29bfe', marginBottom: 16 }}>Active Agents ({AXIOM_AGENTS.filter(a => a.status === 'active').length}/{AXIOM_AGENTS.length})</h2>
          {AXIOM_AGENTS.map(agent => <AgentCard key={agent.name} {...agent} />)}
        </div>
      )}

      {activeTab === 'pipelines' && (
        <div>
          <h2 style={{ color: '#a29bfe' }}>Live Pipelines</h2>
          <p style={{ color: '#dfe6e9' }}>Lead Pipeline → Scout → Writer → Closer → CRM</p>
          <p style={{ color: '#dfe6e9' }}>Cannabis Outreach → Scout → Operator → Follow-up</p>
          <p style={{ color: '#dfe6e9' }}>Content Engine → Writer → Publisher → Analytics</p>
        </div>
      )}

      {activeTab === 'logs' && (
        <div>
          <h2 style={{ color: '#a29bfe' }}>System Logs</h2>
          <pre style={{ background: '#1a1a2e', padding: 16, borderRadius: 8, color: '#00b894', fontSize: 12 }}>
            [AXIOM] System boot complete{`\n`}
            [SCOUT] 3 new leads identified{`\n`}
            [CLOSER] Proposal sent to lead #441{`\n`}
            [OPERATOR] Revenue routed to merch pipeline{`\n`}
            [WRITER] 2 posts queued for publish
          </pre>
        </div>
      )}
    </div>
  );
}
