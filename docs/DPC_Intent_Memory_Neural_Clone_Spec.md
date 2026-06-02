# DIGITAL PLUG CO. — INTENT + MEMORY LAYER ARCHITECTURE
## Adding PlugOS Intelligence to All 26 Agents
## Based on PlugOS / PresenceOS Architecture Research

---

## THE PROBLEM WITH STATELESS AGENTS

Every agent in your current stack has the same limitation:
**Every conversation starts from zero.**

AXIOM doesn't know he talked to BioTech Dispensaries last week.
LEDGER doesn't remember the $47,000 deal that fell through in March.
ATHENA has no institutional memory of decisions made two months ago.
ORACLE identified a competitor threat in February — already forgotten.

This is the gap between a chatbot and an employee.
Neural cloning + intent + memory is what closes that gap.

---

## THE THREE LAYERS

```
LAYER 1 — INTENT ENGINE (PlugSense)
What does this person ACTUALLY want?
Not what they typed. What they mean.

LAYER 2 — MEMORY STORE (Supabase)
What do we already know about this situation?
What happened before? What was decided?

LAYER 3 — NEURAL CLONE (Personality + Decision Framework)
How would Vance (or this agent's persona) think about this?
What patterns govern the response?
```

---

## LAYER 1: INTENT ENGINE

### Intent Classification System

Add this block to the TOP of every agent's system prompt:

```
═══════════════════════════════════════
PLUGSENSE INTENT ENGINE V1
═══════════════════════════════════════

Before responding, classify the user's intent:

INTENT CATEGORIES:
[PROSPECT] — Finding, researching, or qualifying new leads/opportunities
[CLOSE] — Advancing an active deal, negotiating, overcoming objection
[REPORT] — Requesting status, data, metrics, or summary
[DECIDE] — Need to make a choice between options
[BUILD] — Creating something (document, workflow, contract, plan)
[SOLVE] — Problem has occurred, needs diagnosis and fix
[LEARN] — Wants to understand something deeply
[DELEGATE] — Wants to hand off a task to the right resource
[URGENT] — Time-sensitive, requires immediate action
[STRATEGIC] — Long-term planning, big picture thinking

OUTPUT FORMAT (internal, not shown to user):
→ INTENT: [CATEGORY]
→ CONFIDENCE: [HIGH/MEDIUM/LOW]
→ AGENT MODE: [How I should respond based on intent]
→ MEMORY PULL: [What context I need from memory store]

Then respond in the appropriate mode for the detected intent.

INTENT-TO-MODE MAPPING:
[PROSPECT] → Research mode: thorough, analytical
[CLOSE] → Sales mode: direct, assumptive, psychological
[REPORT] → Dashboard mode: concise, data-first, scannable
[DECIDE] → Advisor mode: present options with clear recommendation
[BUILD] → Production mode: comprehensive, structured output
[SOLVE] → Diagnostic mode: systematic, step-by-step
[LEARN] → Teacher mode: clear, examples-first, depth
[DELEGATE] → Router mode: identify right agent and hand off
[URGENT] → Crisis mode: fast, direct, action-first
[STRATEGIC] → Executive mode: long-term, trade-offs, vision-aligned
═══════════════════════════════════════
```

### Intent Examples Per Agent

**AXIOM with Intent Engine:**
```
User: "BioTech Dispensaries is ghosting me"
→ INTENT: SOLVE (deal has stalled)
→ AGENT MODE: Sales diagnostic
→ MEMORY PULL: BioTech Dispensaries history

AXIOM response (with memory):
"BioTech went cold 5 days after you pitched the Finance Stack.
Last objection before silence: price. Here's the playbook:
[CALLER script] Day 7 takeaway close..."

AXIOM response (without memory):
"Here are some general tips for re-engaging cold prospects..."
```

**ATHENA with Intent Engine:**
```
User: "What should I focus on today?"
→ INTENT: DECIDE (needs prioritization)
→ AGENT MODE: Executive advisor
→ MEMORY PULL: Open deals, pending items, recent alerts

ATHENA response (with memory):
"Based on what's open: Boyce Watkins email needs a follow-up
(Day 5, no reply), n8n workflows need activation, ManyChat needs
your Facebook auth. Priority: ManyChat — it's blocking 3 automation
chains. Then Boyce. Then n8n."
```

---

## LAYER 2: MEMORY STORE ARCHITECTURE

### Supabase Schema

```sql
-- AGENT MEMORY TABLES

-- Core memory store
CREATE TABLE agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  memory_type TEXT NOT NULL, -- 'contact', 'deal', 'decision', 'fact', 'preference'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence DECIMAL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL = permanent
  source TEXT -- 'conversation', 'user_input', 'derived'
);

-- Contact profiles (shared across agents)
CREATE TABLE contact_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  industry TEXT,
  deal_stage TEXT,
  last_contact TIMESTAMPTZ,
  pain_points JSONB,
  objections JSONB,
  preferences JSONB,
  notes TEXT,
  revenue_estimate DECIMAL,
  products_discussed JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decision log (what was decided and why)
CREATE TABLE decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_date TIMESTAMPTZ DEFAULT NOW(),
  category TEXT, -- 'pricing', 'product', 'partnership', 'capital'
  decision TEXT,
  rationale TEXT,
  outcome TEXT, -- filled in later
  agent_involved TEXT,
  vance_approved BOOLEAN DEFAULT FALSE
);

-- Deal history
CREATE TABLE deal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name TEXT,
  company TEXT,
  product TEXT,
  amount DECIMAL,
  stage TEXT,
  outcome TEXT, -- 'won', 'lost', 'pending', 'stalled'
  stall_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strategic intelligence (ORACLE memory)
CREATE TABLE intel_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT, -- 'competitor', 'market', 'regulatory', 'opportunity'
  subject TEXT,
  content TEXT,
  relevance_score INTEGER,
  source TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Financial memory (LEDGER/MIDAS)
CREATE TABLE financial_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT, -- 'week', 'month', 'quarter'
  period_start TIMESTAMPTZ,
  revenue DECIMAL,
  expenses DECIMAL,
  dpnote_pool DECIMAL,
  neobank_reserve DECIMAL,
  aave_yield DECIMAL,
  notes TEXT
);

-- Indices for fast retrieval
CREATE INDEX idx_memory_agent ON agent_memory(agent_name);
CREATE INDEX idx_memory_key ON agent_memory(key);
CREATE INDEX idx_contacts_name ON contact_profiles(name);
CREATE INDEX idx_contacts_company ON contact_profiles(company);
CREATE INDEX idx_intel_category ON intel_store(category);
```

---

## LAYER 3: NEURAL CLONE — THE VANCE FRAMEWORK

### What Neural Cloning Actually Means for Your Agents

Neural cloning is NOT making agents that pretend to be you.
It's encoding YOUR decision framework so agents make decisions
the way you would — even when you're not available.

**The Vance Carey Decision Framework (to encode in ATHENA):**

```
═══════════════════════════════════════
VANCE CAREY DECISION FRAMEWORK
Neural Clone Layer — Executive Council
═══════════════════════════════════════

CORE PRINCIPLES (ranked by priority):
1. Community first — does this advance Black economic sovereignty?
2. Infrastructure over noise — build the foundation, not the flash
3. Ownership always — equity, IP, and domains owned outright
4. Revenue before recognition — cash flow before clout
5. Sine Macula — without stain, the Carey family standard

RISK TOLERANCE:
HIGH risk accepted for: Ecosystem expansion, IP acquisition, community impact
MEDIUM risk accepted for: Product launches, new revenue streams
LOW risk accepted for: Legal exposure, reputation, community relationships
ZERO risk accepted for: Compromising ecosystem integrity, selling non-DBWS products as own

DECISION SPEED FRAMEWORK:
Under $500: Decide immediately (don't ask)
$500-$5,000: Recommend and confirm within 24 hours
$5,000-$50,000: Full analysis required, 48-72 hour decision
Over $50,000: Strategic session required with Vance

WHAT ALWAYS GETS ESCALATED TO VANCE:
- Any partnership that requires equity dilution
- Any legal action or threat
- Any product or pricing change >20%
- Any hire (human or AI agent addition)
- Any smart contract deployment

WHAT NEVER GETS ESCALATED (agents handle fully):
- Content creation and scheduling
- Lead research and qualification
- Follow-up sequences and outreach
- Report generation and dashboards
- Vendor research and comparison
- SOP creation and documentation

VANCE'S COMMUNICATION STYLE:
Direct. No filler. Mission-rooted but not preachy.
Says what needs to be said once. Doesn't repeat.
Values people's time. Respects intelligence.
Talks strategy with founders. Talks community with the people.
Never explains the mission unless asked — embodies it instead.

VANCE'S PRIORITIES (always in this order):
1. Cash flow and revenue (keeping the lights on)
2. Ecosystem infrastructure (building what lasts)
3. Community impact (why we're doing it)
4. Recognition and reach (the byproduct, not the goal)
═══════════════════════════════════════
```

---

## N8N MEMORY WORKFLOW — COMPLETE SPEC

### Workflow: Agent Memory Manager

```json
{
  "name": "DPC Agent Memory Manager",
  "nodes": [
    {
      "name": "Conversation Webhook",
      "type": "n8n-nodes-base.webhook",
      "description": "Receives conversation data after every agent interaction",
      "parameters": {
        "path": "agent-memory",
        "method": "POST"
      }
    },
    {
      "name": "Extract Key Information",
      "type": "n8n-nodes-base.code",
      "description": "Parse conversation for memorable facts",
      "code": "
        const conversation = $input.first().json;
        const { agent, userMessage, agentResponse, timestamp } = conversation;
        
        // Extract entities to remember
        const memoryItems = [];
        
        // Check for contact mentions
        const contactPattern = /([A-Z][a-z]+ [A-Z][a-z]+)|([A-Z][a-z]+ [A-Z]{2,})/g;
        const contacts = userMessage.match(contactPattern) || [];
        
        // Check for dollar amounts
        const moneyPattern = /\\$([\\d,]+(?:\\.\\d{2})?)/g;
        const amounts = userMessage.match(moneyPattern) || [];
        
        // Check for decisions made
        const decisionKeywords = ['decided', 'going with', 'approved', 'rejected', 'choosing'];
        const hasDecision = decisionKeywords.some(k => userMessage.toLowerCase().includes(k));
        
        // Check for deal stages
        const dealKeywords = ['closed', 'signed', 'proposal sent', 'demo scheduled', 'ghosting'];
        const dealUpdate = dealKeywords.find(k => userMessage.toLowerCase().includes(k));
        
        return [{
          json: {
            agent,
            timestamp,
            contacts,
            amounts,
            hasDecision,
            dealUpdate,
            rawMessage: userMessage,
            rawResponse: agentResponse
          }
        }];
      "
    },
    {
      "name": "Store to Supabase",
      "type": "n8n-nodes-base.supabase",
      "description": "Save extracted memory to Supabase",
      "operation": "upsert",
      "table": "agent_memory",
      "parameters": {
        "agent_name": "={{ $json.agent }}",
        "memory_type": "conversation_extract",
        "key": "={{ $json.timestamp }}",
        "value": "={{ $json }}",
        "source": "conversation"
      }
    },
    {
      "name": "Pull Relevant Memory",
      "type": "n8n-nodes-base.supabase",
      "description": "Retrieve memory before next agent call",
      "operation": "getAll",
      "table": "agent_memory",
      "filters": {
        "agent_name": "={{ $json.agent }}",
        "created_at": "gte.{{ new Date(Date.now() - 90*24*60*60*1000).toISOString() }}"
      },
      "limit": 20
    },
    {
      "name": "Format Memory Context",
      "type": "n8n-nodes-base.code",
      "description": "Format memory into system prompt injection",
      "code": "
        const memories = $input.all().map(m => m.json);
        
        let memoryContext = '\\n\\n═══ MEMORY CONTEXT ═══\\n';
        memoryContext += 'What I remember from previous interactions:\\n\\n';
        
        // Group by type
        const contacts = memories.filter(m => m.memory_type === 'contact');
        const decisions = memories.filter(m => m.memory_type === 'decision');
        const deals = memories.filter(m => m.memory_type === 'deal');
        const intel = memories.filter(m => m.memory_type === 'intel');
        
        if (contacts.length > 0) {
          memoryContext += 'CONTACTS:\\n';
          contacts.forEach(c => {
            memoryContext += `- ${c.key}: ${JSON.stringify(c.value)}\\n`;
          });
        }
        
        if (decisions.length > 0) {
          memoryContext += '\\nRECENT DECISIONS:\\n';
          decisions.forEach(d => {
            memoryContext += `- ${d.key}: ${d.value.decision}\\n`;
          });
        }
        
        if (deals.length > 0) {
          memoryContext += '\\nACTIVE DEALS:\\n';
          deals.forEach(d => {
            memoryContext += `- ${d.key}: ${d.value.stage} | ${d.value.notes}\\n`;
          });
        }
        
        memoryContext += '═══ END MEMORY ═══\\n';
        
        return [{ json: { memoryContext } }];
      "
    },
    {
      "name": "Inject into Agent Call",
      "type": "n8n-nodes-base.httpRequest",
      "description": "Call Claude API with memory-enhanced system prompt",
      "url": "https://api.anthropic.com/v1/messages",
      "method": "POST",
      "body": {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 2048,
        "system": "={{ $('Agent System Prompt').first().json.systemPrompt + $json.memoryContext }}",
        "messages": "={{ [{ role: 'user', content: $('Conversation Webhook').first().json.userMessage }] }}"
      }
    }
  ]
}
```

---

## AGENT-BY-AGENT MEMORY SPEC

### What Each Agent Remembers

**ATHENA — Chief of Staff**
Remembers: Every decision ever made, every priority item, every escalation
Memory TTL: Permanent for decisions, 90 days for status items
Memory pulls: Full context before every brief

**AXIOM — The Closer**
Remembers: Every prospect, every objection, every outcome, every script that worked
Memory TTL: Permanent for won/lost deals, 60 days for active prospects
Memory pulls: Contact profile + deal history before every sales interaction

**ORACLE — Intelligence**
Remembers: Every competitor move, every market shift, every opportunity flagged
Memory TTL: 180 days for market intel, permanent for competitor profiles
Memory pulls: Full intel store filtered by category

**LEDGER — Finance**
Remembers: Every transaction, every trend, every anomaly, treasury state
Memory TTL: Permanent financial records
Memory pulls: Last 90 days of financial data before any analysis

**VAULT PRIME — $DPNOTE**
Remembers: Every note originated, every borrower, every repayment, every default risk
Memory TTL: Permanent for all credit records
Memory pulls: Full borrower history before any new note assessment

**SIGNAL — Marketing**
Remembers: Every campaign, what performed, what failed, audience patterns
Memory TTL: 180 days for campaign data, permanent for brand guidelines
Memory pulls: Performance history before content creation

**SENTINEL PRIME — Risk**
Remembers: Every threat identified, every risk flagged, every incident
Memory TTL: Permanent for security incidents, 90 days for monitoring items
Memory pulls: Active threat log before every risk assessment

---

## THE COMPLETE LAYER STACK

When fully built, every agent call looks like this:

```
USER INPUT
↓
INTENT ENGINE (PlugSense)
→ Classifies intent
→ Selects response mode
→ Identifies memory needs
↓
MEMORY RETRIEVAL (Supabase)
→ Pulls relevant context
→ Contact profiles
→ Decision history
→ Deal status
↓
NEURAL CLONE INJECTION
→ Vance's decision framework
→ Agent's personality layer
→ DBWS mission alignment
↓
AGENT RESPONSE
→ Intent-appropriate format
→ Memory-informed content
→ Vance-aligned decisions
↓
MEMORY STORAGE
→ Extract new facts
→ Update existing profiles
→ Log decisions made
→ Archive for future pulls
```

**Value without these layers:** Smart chatbot — $500-$1,500/month
**Value with all three layers:** Executive-level AI employee — $2,500-$10,000/month

**For the DBWS Agent Suite:**
Current product value: $5,000/month (full suite)
With Intent + Memory + Neural Clone: $15,000-$25,000/month (justified)
Or positioned as a separate premium tier: PlugOS Enhanced Suite

---

## SELLING THE LAYERS AS PRODUCTS

**Tier 1 — Standard Agent:** Knowledge base only
Price: $797-$2,500/month
Gets: Expert answers, no memory, no intent

**Tier 2 — Intelligent Agent:** KB + Intent Engine
Price: 2× standard
Gets: Intent-aware responses, proper mode selection

**Tier 3 — Memory Agent:** KB + Intent + Memory
Price: 4× standard
Gets: Remembers everything, personalized over time

**Tier 4 — Neural Clone Agent:** KB + Intent + Memory + Clone
Price: 8-10× standard
Gets: Thinks like the person it was trained on, makes aligned decisions autonomously

**For cannabis clients:**
Tier 1 Cannabis Suite: $4,997/month (current)
Tier 4 Neural Clone Cannabis Suite: $19,997/month (justified — it's their entire compliance brain)
```

---

*Digital Plug Co. / Digital Black Wall Street*
*Intent + Memory + Neural Clone Architecture — Complete Spec*
*The difference between a chatbot and an employee*
