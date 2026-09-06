import { PrismaClient } from '@prisma/client';
import { Role } from '@/lib/enums';
import bcrypt from 'bcryptjs';
import { newInterviewState, type InterviewState, type InterviewStep } from '@/lib/interview-engine';
import { extractProcessFacts } from '@/lib/process-facts';
import { generateSopMarkdown } from '@/lib/sop-template';

const prisma = new PrismaClient();

// All demo accounts share this password (see also src/app/login/page.tsx, which lists them).
const DEMO_PASSWORD = 'Passw0rd!';

const DEMO_USERS: { name: string; email: string; role: Role; jobTitle: string }[] = [
  { name: 'Aisha Khan', email: 'admin@analytix.demo', role: 'ADMINISTRATOR', jobTitle: 'Platform Administrator' },
  { name: 'Rashid Al Marri', email: 'ceo@analytix.demo', role: 'MANAGEMENT_CEO', jobTitle: 'Group CEO' },
  { name: 'Fatima Noor', email: 'depthead@analytix.demo', role: 'DEPARTMENT_HEAD', jobTitle: 'Head of Business Setup & Corporate Services' },
  { name: 'Sandeep Menon', email: 'processowner@analytix.demo', role: 'PROCESS_OWNER', jobTitle: 'Team Lead, Company Formation' },
  { name: 'Priya Nair', email: 'employee@analytix.demo', role: 'EMPLOYEE', jobTitle: 'Case Officer' },
  { name: 'Transformation Committee', email: 'committee@analytix.demo', role: 'AI_TRANSFORMATION_COMMITTEE', jobTitle: 'AI Transformation Committee Member' },
  { name: 'Wei Zhang', email: 'tech@analytix.demo', role: 'TECHNOLOGY_TEAM', jobTitle: 'Technology Lead' },
  { name: 'Omar Haddad', email: 'infosec@analytix.demo', role: 'INFORMATION_SECURITY', jobTitle: 'Information Security Officer' },
  { name: 'Layla Saeed', email: 'legal@analytix.demo', role: 'LEGAL_COMPLIANCE_REVIEWER', jobTitle: 'Legal & Compliance Reviewer' }
];

// The 10 Analytix service divisions (spec section 62 extension), each with a representative,
// fully-worked sample process so every read-only Phase 3/4 module (Digital Twin, Process Maps,
// SOP Library, Bottlenecks, AI Opportunities) has something realistic to show for every division —
// not just the single Company Formation example. This is illustrative sample content, seeded the
// same way the original demo project was: it is NOT derived from a real employee interview, even
// though it is stored in the same shape (Interview + Process + Sop) a real captured process would
// be, so every downstream page renders exactly as it would for genuine data. The seeded interview
// is attributed to a demo account (Priya Nair, already flagged "Demo" on the Users & Roles page).
type SampleStep = { text: string; owner: string; systems: string[] };

type ServiceDivisionSeed = {
  name: string; // division = department name
  serviceArea: string;
  departmentHead?: Role; // only Business Setup keeps the originally-seeded head; rest are unassigned
  project: {
    name: string;
    description: string;
    businessObjective: string;
    aiProjectIdea: string;
    interviewObjective: string;
    inScopeActivities: string;
    outOfScopeActivities: string;
    currentSystems: string;
    existingPainPoints: string;
    currentVolume: string;
    currentManpower: string;
  };
  process: {
    name: string;
    role: string;
    trigger: string;
    outcome: string;
    frequency: string;
    steps: SampleStep[];
    systemsMentioned: string[];
    deps: Partial<InterviewState['deps']>;
    problems: Partial<InterviewState['problems']>;
    checkerDetail: string;
    rejectionHandling: string;
    waitDetail: string;
    exceptions: string[];
    knowledge: string[];
    templates: string[];
    aiObservations?: { text: string; status: 'confirmed' | 'partly'; key: string }[];
  };
};

const SERVICE_DIVISIONS: ServiceDivisionSeed[] = [
  {
    name: 'Business Setup & Corporate Services',
    serviceArea: 'Business Setup & PRO/GRO',
    departmentHead: 'DEPARTMENT_HEAD',
    project: {
      name: 'AI Company Formation Case Assistant',
      description:
        'Understand how company formation cases are actually processed today, then design an AI assistant for document handling, follow-up and status tracking.',
      businessObjective: 'Reduce case turnaround time and manual follow-up effort for company formation cases.',
      aiProjectIdea:
        'A case assistant that checks document completeness, drafts client follow-ups, and tracks government portal status automatically.',
      interviewObjective: 'Reconstruct the real, current company formation workflow end-to-end, including every handoff, wait and exception.',
      inScopeActivities:
        'Client engagement\nDocument collection\nDocument completeness checking\nMissing-document follow-up\nOdoo case update\nTeam-lead review\nGovernment authority submission\nStatus monitoring\nApproval/output handling\nClient handover',
      outOfScopeActivities: 'Contract drafting\nPricing and invoicing\nMarketing and lead generation',
      currentSystems: 'Odoo, Excel, Government Portal, WhatsApp, Email',
      existingPainPoints:
        'Missing documents\nDuplicate data entry across Odoo and Excel\nManual client follow-up\nManual government portal status checking\nRejection-handling knowledge held by a few experienced staff',
      currentVolume: '20-25 cases / month (approximate, to be confirmed during interviews)',
      currentManpower: '3 case officers, 1 team lead'
    },
    process: {
      name: 'New Company Formation & Licensing',
      role: 'Case Officer',
      trigger: 'A client engages Analytix to set up a new company or branch',
      outcome: 'Trade license issued and the complete company file handed over to the client',
      frequency: '20-25 new cases per month',
      steps: [
        { text: 'Meet the client and capture their business setup requirements', owner: 'Case Officer', systems: [] },
        { text: 'Run a feasibility check on jurisdiction, activity and licensing options', owner: 'Case Officer', systems: ['Government Portal'] },
        { text: 'Prepare and send the client a setup proposal with cost breakdown', owner: 'Case Officer', systems: ['Excel'] },
        { text: 'Collect KYC documents (passport, Emirates ID, NOC, etc.) from the client', owner: 'Case Officer', systems: ['WhatsApp', 'Email'] },
        { text: 'Log the case and documents in Odoo', owner: 'Case Officer', systems: ['Odoo'] },
        { text: 'Submit the company registration application to the licensing authority', owner: 'Case Officer', systems: ['Government Portal'] },
        { text: 'Team lead reviews the file before submission', owner: 'Team Lead', systems: [] },
        { text: 'Track application status on the government portal until the license is issued', owner: 'Case Officer', systems: ['Government Portal'] },
        { text: 'Hand over the trade license and incorporation documents to the client', owner: 'Case Officer', systems: ['Email'] }
      ],
      systemsMentioned: ['Odoo', 'Excel', 'Government Portal', 'WhatsApp', 'Email'],
      deps: { manager: true, authority: true, client: true },
      problems: { missingDocs: true, followUp: true, waiting: true, repeatedEntry: true },
      checkerDetail: 'Team Lead reviews every file before it is submitted to the authority',
      rejectionHandling: 'If the authority rejects the submission, the case officer corrects the flagged issue and resubmits, which can add 3-5 days',
      waitDetail: 'Waiting on government portal processing, typically 5-10 business days',
      exceptions: [
        'Client submits an incomplete or expired document',
        "The activity requires an additional external approval (e.g. municipality, free zone authority)"
      ],
      knowledge: ['Jurisdiction and activity licensing matrix', 'Standard KYC document checklist'],
      templates: ['Company setup proposal template', 'KYC checklist'],
      aiObservations: [
        { text: 'Case officers re-key the same client documents into both Odoo and Excel', status: 'confirmed', key: 'repeatedEntry' },
        { text: 'Government portal status is checked manually multiple times a day', status: 'confirmed', key: 'waiting' }
      ]
    }
  },
  {
    name: 'PRO / GRO & Government Services',
    serviceArea: 'Business Setup & PRO/GRO',
    project: {
      name: 'AI Visa & Government Services Tracker',
      description: 'Understand how visa, labor and government-portal transactions are processed today, then design an AI assistant to track status and renewals.',
      businessObjective: 'Reduce visa processing turnaround and eliminate missed renewal deadlines.',
      aiProjectIdea: "An assistant that tracks every visa's status and renewal date automatically and drafts the government portal submission.",
      interviewObjective: 'Reconstruct the current visa issuance and renewal workflow end-to-end, including every follow-up and wait.',
      inScopeActivities: 'Visa/Iqama applications\nRenewals\nLabor card issuance\nMedical & Emirates ID scheduling\nStatus tracking',
      outOfScopeActivities: 'Company licensing itself\nPayroll processing',
      currentSystems: 'Government Portal, Odoo, Excel, WhatsApp, Email',
      existingPainPoints:
        'Manual renewal-date tracking in Excel\nRepeated portal status checks\nDelayed HR follow-up when documents are missing',
      currentVolume: '40-50 visa transactions / month (approximate)',
      currentManpower: '2 PRO officers, 1 team lead'
    },
    process: {
      name: 'Employee Visa Issuance & Renewal',
      role: 'PRO Officer',
      trigger: "HR raises a request for a new employee visa or an existing visa nearing expiry",
      outcome: "The visa is stamped/renewed and the employee's Emirates ID and labor card are issued",
      frequency: '40-50 visa transactions per month across all client companies',
      steps: [
        { text: 'Receive the visa request and employee documents from HR/client', owner: 'PRO Officer', systems: ['Email', 'WhatsApp'] },
        { text: 'Check document completeness (passport, photo, medical, offer letter)', owner: 'PRO Officer', systems: [] },
        { text: 'Submit the entry permit / visa application on the government immigration portal', owner: 'PRO Officer', systems: ['Government Portal'] },
        { text: "Schedule and track the employee's medical test and Emirates ID biometrics", owner: 'PRO Officer', systems: ['Government Portal'] },
        { text: 'Follow up on approval status with the authority', owner: 'PRO Officer', systems: ['Government Portal'] },
        { text: 'Stamp the visa once approved and update the immigration/labor records', owner: 'PRO Officer', systems: ['Government Portal'] },
        { text: 'Update case status in Odoo and notify the client', owner: 'PRO Officer', systems: ['Odoo', 'WhatsApp'] },
        { text: 'Track the renewal due date and start renewal 60 days before expiry', owner: 'PRO Officer', systems: ['Excel'] }
      ],
      systemsMentioned: ['Government Portal', 'Odoo', 'Excel', 'WhatsApp', 'Email'],
      deps: { authority: true, client: true, manager: true },
      problems: { waiting: true, followUp: true, missingDocs: true, delays: true },
      checkerDetail: 'Team lead spot-checks visa applications above a certain salary/category before submission',
      rejectionHandling: 'If the authority raises an objection, the PRO officer resolves it (extra document, correction) and resubmits',
      waitDetail: 'Immigration and medical approvals typically take 4-7 working days',
      exceptions: ['An employee fails the medical test', "The company's immigration file has an outstanding violation blocking new visas"],
      knowledge: ['Visa category and quota rules by activity', 'Renewal timeline calendar'],
      templates: ['Visa checklist', 'Renewal tracker sheet']
    }
  },
  {
    name: 'Business Advisory & Management Consulting',
    serviceArea: 'Business Advisory & Strategic Consulting',
    project: {
      name: 'AI Feasibility & Advisory Assistant',
      description: 'Understand how advisory engagements are scoped and delivered today, then design an AI assistant to speed up research and report drafting.',
      businessObjective: 'Cut the time consultants spend on secondary research and first-draft report assembly.',
      aiProjectIdea: 'An assistant that pulls market/competitor data and drafts the first version of the feasibility report from the engagement brief.',
      interviewObjective: 'Reconstruct the current advisory engagement workflow end-to-end, from kickoff to implementation support.',
      inScopeActivities: 'Requirement capture\nDiagnostic\nSecondary research\nFinancial/market modelling\nReport drafting\nClient presentation',
      outOfScopeActivities: 'Legal drafting\nAccounting/tax filing work',
      currentSystems: 'Excel, SharePoint, Email',
      existingPainPoints: 'Manual secondary research\nReport formatting takes disproportionate time\nWaiting on client-provided financial data',
      currentVolume: '6-10 advisory engagements / month',
      currentManpower: '4 consultants, 1 senior consultant'
    },
    process: {
      name: 'Market Entry Feasibility Study',
      role: 'Management Consultant',
      trigger: 'A client requests a feasibility study or market-entry strategy',
      outcome: 'A feasibility report with a go/no-go recommendation is delivered and presented to the client',
      frequency: '6-10 advisory engagements per month',
      steps: [
        { text: "Capture the client's business requirement and objectives in a kickoff call", owner: 'Consultant', systems: [] },
        { text: "Run a diagnostic on the client's current business/market position", owner: 'Consultant', systems: [] },
        { text: 'Collect secondary market data and competitor information', owner: 'Consultant', systems: ['Excel'] },
        { text: 'Analyze the data and build the financial/market model', owner: 'Consultant', systems: ['Excel'] },
        { text: 'Draft the recommendation and feasibility report', owner: 'Consultant', systems: ['SharePoint'] },
        { text: 'Internal peer review of the report before client delivery', owner: 'Senior Consultant', systems: [] },
        { text: 'Present findings and the recommendation to the client', owner: 'Consultant', systems: [] },
        { text: 'Support the client through the first 30 days of the implementation plan', owner: 'Consultant', systems: ['Email'] }
      ],
      systemsMentioned: ['Excel', 'SharePoint', 'Email'],
      deps: { client: true, manager: true },
      problems: { waiting: true, unclearResp: true },
      checkerDetail: 'Senior consultant reviews every report before client delivery',
      rejectionHandling: 'If the client disputes an assumption, the consultant revisits the data and reissues the report',
      waitDetail: 'Waiting on client-side data (financials, internal figures) is the most common delay',
      exceptions: [
        'The client cannot provide the financial data needed for the model',
        'Scope expands mid-engagement beyond the signed proposal'
      ],
      knowledge: ['Market and sector research library', 'Feasibility report template'],
      templates: ['Feasibility report template', 'Financial model template']
    }
  },
  {
    name: 'Legal Advisory & Compliance',
    serviceArea: 'Legal Advisory & Dispute Resolution',
    project: {
      name: 'AI Contract Review Assistant',
      description: 'Understand how commercial contracts are reviewed and drafted today, then design an AI assistant to flag risk clauses and speed up first drafts.',
      businessObjective: 'Reduce contract turnaround time and standardize risk-flagging across advisors.',
      aiProjectIdea: 'An assistant that flags non-standard or high-risk clauses against Analytix policy and drafts a client-facing risk summary.',
      interviewObjective: 'Reconstruct the current contract review and drafting workflow end-to-end, including sign-off.',
      inScopeActivities: 'Intake & conflict check\nContract review\nDrafting/markup\nNegotiation support\nCompliance sign-off\nIssuance',
      outOfScopeActivities: 'Court litigation\nDebt recovery collections work',
      currentSystems: 'Odoo, SharePoint, Email',
      existingPainPoints: 'Manual clause-by-clause review\nWaiting on client/counterparty feedback\nRisk knowledge concentrated in senior advisors',
      currentVolume: '30-40 contract requests / month',
      currentManpower: '3 legal advisors, 1 compliance reviewer'
    },
    process: {
      name: 'Commercial Contract Review & Drafting',
      role: 'Legal Advisor',
      trigger: 'A client or internal team requests review or drafting of a commercial contract',
      outcome: 'A reviewed/drafted contract is delivered with a legal risk summary, ready for signature',
      frequency: '30-40 contract requests per month',
      steps: [
        { text: 'Log the request and run a conflict-of-interest / KYC check', owner: 'Legal Advisor', systems: ['Odoo'] },
        { text: 'Review the contract or requirement against applicable law and Analytix policy', owner: 'Legal Advisor', systems: [] },
        { text: 'Draft or mark up the contract with recommended clauses', owner: 'Legal Advisor', systems: ['SharePoint'] },
        { text: 'Send the draft to the client with a summary of key risks and changes', owner: 'Legal Advisor', systems: ['Email'] },
        { text: 'Negotiate and incorporate client/counterparty feedback', owner: 'Legal Advisor', systems: ['Email'] },
        { text: 'Legal & Compliance Reviewer signs off before final issuance', owner: 'Legal & Compliance Reviewer', systems: [] },
        { text: 'Issue the final contract and close the file', owner: 'Legal Advisor', systems: ['Odoo'] }
      ],
      systemsMentioned: ['Odoo', 'SharePoint', 'Email'],
      deps: { client: true, manager: true },
      problems: { waiting: true, delays: true },
      checkerDetail: 'Legal & Compliance Reviewer signs off every contract before it is issued',
      rejectionHandling: 'If the compliance reviewer flags a clause, the advisor revises it and resubmits for sign-off',
      waitDetail: 'Waiting on client/counterparty feedback on draft terms',
      exceptions: [
        "The contract involves a jurisdiction Analytix doesn't usually operate in and needs external counsel",
        "The counterparty requests clauses outside Analytix's standard risk appetite"
      ],
      knowledge: ['Standard clause library', 'Regulatory reference set by jurisdiction'],
      templates: ['Contract review checklist', 'Standard NDA / services agreement templates']
    }
  },
  {
    name: 'Accounting, Tax & Audit',
    serviceArea: 'Accounting, Tax & Audit',
    project: {
      name: 'AI VAT Filing Assistant',
      description: 'Understand how monthly VAT filing is processed today, then design an AI assistant to reconcile transactions and flag exceptions.',
      businessObjective: 'Reduce reconciliation time and the rate of late or corrected filings.',
      aiProjectIdea: 'An assistant that reconciles invoices against the ledger automatically and flags anything that needs accountant review before filing.',
      interviewObjective: 'Reconstruct the current VAT filing workflow end-to-end, including reconciliation and review.',
      inScopeActivities: 'Invoice collection\nBookkeeping\nBank reconciliation\nVAT computation\nReview\nFiling\nClient reporting',
      outOfScopeActivities: 'Statutory audit fieldwork\nPayroll processing',
      currentSystems: 'Odoo, Excel, Government Portal, Email, WhatsApp',
      existingPainPoints: 'Missing or late client invoices\nDuplicate reconciliation work across Odoo and Excel\nTight month-end filing deadlines',
      currentVolume: '~60 VAT filings / month across the client portfolio',
      currentManpower: '5 accountants, 1 senior accountant'
    },
    process: {
      name: 'Monthly VAT Return Filing',
      role: 'Accountant',
      trigger: 'Month-end close triggers the VAT filing cycle for a client',
      outcome: 'The VAT return is filed with the tax authority and the client receives a filed-copy confirmation',
      frequency: 'Filed monthly/quarterly per client (~60 filings per month across the portfolio)',
      steps: [
        { text: "Collect the client's sales and purchase invoices for the period", owner: 'Accountant', systems: ['Email', 'WhatsApp'] },
        { text: 'Post transactions and reconcile the books in Odoo', owner: 'Accountant', systems: ['Odoo'] },
        { text: 'Reconcile bank statements against the ledger', owner: 'Accountant', systems: ['Odoo', 'Excel'] },
        { text: 'Prepare the VAT working file and compute the liability', owner: 'Accountant', systems: ['Excel'] },
        { text: 'Senior accountant reviews the working file', owner: 'Senior Accountant', systems: [] },
        { text: 'File the VAT return on the tax authority portal', owner: 'Accountant', systems: ['Government Portal'] },
        { text: 'Share the filed confirmation and summary with the client', owner: 'Accountant', systems: ['Email'] }
      ],
      systemsMentioned: ['Odoo', 'Excel', 'Government Portal', 'Email', 'WhatsApp'],
      deps: { client: true, manager: true, authority: true },
      problems: { missingDocs: true, repeatedEntry: true, delays: true },
      checkerDetail: 'Senior accountant reviews the VAT working file before filing',
      rejectionHandling: "If figures don't reconcile, the accountant traces the discrepancy back to source invoices before refiling the working file",
      waitDetail: 'Waiting on the client to send missing invoices or bank statements is the main delay',
      exceptions: ['Client invoices are missing or in the wrong currency', 'A transaction needs a VAT treatment clarification from the authority'],
      knowledge: ['VAT treatment rules by transaction type', 'Filing deadline calendar per client'],
      templates: ['VAT working file template', 'Reconciliation checklist']
    }
  },
  {
    name: 'Industrial & Manufacturing Services',
    serviceArea: 'Industrial & Manufacturing Support',
    project: {
      name: 'AI Industrial Licensing Tracker',
      description: 'Understand how industrial/factory setup cases move through multiple approving authorities today, then design an AI assistant to track them.',
      businessObjective: 'Reduce delays caused by uncoordinated multi-authority approval tracking.',
      aiProjectIdea: 'An assistant that tracks every parallel approval (municipality, environment, civil defense) against its own timeline and flags the slowest one.',
      interviewObjective: 'Reconstruct the current industrial setup workflow end-to-end, including all parallel approvals.',
      inScopeActivities: 'Feasibility\nLocation selection\nIndustrial licensing\nEnvironmental/safety approvals\nFacility setup support\nOperational launch',
      outOfScopeActivities: 'Ongoing factory operations management\nEquipment procurement',
      currentSystems: 'Government Portal, Excel, Email',
      existingPainPoints: 'Multiple authorities approving in parallel with no single tracker\nDelays from environmental/civil defense inspections',
      currentVolume: '2-4 industrial setup cases / month',
      currentManpower: '2 industrial setup consultants, 1 team lead'
    },
    process: {
      name: 'Industrial License & Factory Setup',
      role: 'Industrial Setup Consultant',
      trigger: 'A client requests to set up or expand a manufacturing/industrial facility',
      outcome: 'The industrial license is issued and the facility is cleared to commence operations',
      frequency: '2-4 industrial setup cases per month',
      steps: [
        { text: "Assess the client's industrial activity and site feasibility", owner: 'Consultant', systems: [] },
        { text: 'Identify and shortlist suitable industrial locations/zones', owner: 'Consultant', systems: [] },
        { text: 'Prepare and submit the industrial license application', owner: 'Consultant', systems: ['Government Portal'] },
        { text: 'Coordinate environmental and safety approvals', owner: 'Consultant', systems: ['Government Portal'] },
        { text: 'Support facility setup and utility connections', owner: 'Consultant', systems: ['Email'] },
        { text: 'Track compliance requirements (civil defense, environment) through to sign-off', owner: 'Consultant', systems: ['Excel'] },
        { text: 'Confirm operational launch readiness with the client', owner: 'Consultant', systems: [] }
      ],
      systemsMentioned: ['Government Portal', 'Excel', 'Email'],
      deps: { authority: true, manager: true, otherDept: true },
      problems: { waiting: true, delays: true, unclearResp: true },
      checkerDetail: 'Team lead reviews the licensing file before submission given the higher regulatory complexity',
      rejectionHandling: 'If an approval authority raises an objection (e.g. environmental), the consultant resolves it with supporting documentation and resubmits',
      waitDetail: 'Approvals from multiple authorities (municipality, environment, civil defense) run in parallel and each has its own turnaround',
      exceptions: ['The site fails an environmental or civil defense inspection', 'The activity requires a special approval not initially scoped'],
      knowledge: ['Industrial zoning and activity matrix', 'Multi-authority approval checklist'],
      templates: ['Industrial setup checklist']
    }
  },
  {
    name: 'Vendor Registration & Compliance',
    serviceArea: 'Vendor & Compliance',
    project: {
      name: 'AI Vendor Compliance Assistant',
      description: 'Understand how vendor prequalification and certification cases are processed today, then design an AI assistant to track certification gaps.',
      businessObjective: 'Shorten the time to close certification gaps and get clients registered as approved vendors.',
      aiProjectIdea: 'An assistant that checks a client against a target buyers prequalification criteria and generates the gap-closure checklist automatically.',
      interviewObjective: 'Reconstruct the current vendor registration and certification workflow end-to-end.',
      inScopeActivities: 'Eligibility assessment\nGap analysis\nDocument collection\nApplication submission\nCertification audit coordination\nApproval delivery',
      outOfScopeActivities: 'Ongoing vendor performance management\nContract negotiation with the buyer',
      currentSystems: 'Government Portal, SharePoint, Excel, Email',
      existingPainPoints: 'No single tracker for certification gaps\nDelays from certification body audit scheduling',
      currentVolume: '10-15 vendor registration cases / month',
      currentManpower: '2 compliance officers, 1 team lead'
    },
    process: {
      name: 'Vendor Prequalification & Registration',
      role: 'Compliance Officer',
      trigger: 'A client needs to register as an approved vendor with a government or corporate buyer',
      outcome: 'The vendor is registered/certified and listed as an approved supplier',
      frequency: '10-15 vendor registration cases per month',
      steps: [
        { text: "Assess the client's eligibility against the target buyer's prequalification criteria", owner: 'Compliance Officer', systems: [] },
        { text: 'Run a gap analysis against required certifications (ISO, IKTVA, HSE, etc.)', owner: 'Compliance Officer', systems: ['Excel'] },
        { text: 'Collect and organize the required compliance documents', owner: 'Compliance Officer', systems: ['SharePoint'] },
        { text: 'Submit the vendor registration/prequalification application', owner: 'Compliance Officer', systems: ['Government Portal'] },
        { text: 'Coordinate any required certification audit or site verification', owner: 'Compliance Officer', systems: [] },
        { text: 'Track application status until certification/approval', owner: 'Compliance Officer', systems: ['Government Portal'] },
        { text: 'Deliver the approved registration/certificate to the client', owner: 'Compliance Officer', systems: ['Email'] }
      ],
      systemsMentioned: ['Government Portal', 'SharePoint', 'Excel', 'Email'],
      deps: { authority: true, manager: true, client: true },
      problems: { missingDocs: true, waiting: true, noChecklist: true },
      checkerDetail: 'Team lead reviews the compliance file before submission',
      rejectionHandling: 'If the buyer or certifying body flags a gap, the officer closes it and resubmits the application',
      waitDetail: 'Certification body audits and buyer review cycles are the main source of delay',
      exceptions: [
        'The client fails a certification audit and needs a remediation plan',
        "The buyer's prequalification criteria change mid-process"
      ],
      knowledge: ['Certification/standard requirement matrix (ISO, IKTVA, SASO, CE)', 'Vendor registration checklist'],
      templates: ['Gap analysis template', 'Vendor registration checklist']
    }
  },
  {
    name: 'Technology & Digital Solutions',
    serviceArea: 'Technology & Digital',
    project: {
      name: 'AI Implementation Delivery Assistant',
      description: 'Understand how Odoo/digital implementation projects are delivered today, then design an AI assistant to speed up requirements and UAT.',
      businessObjective: 'Shorten the discovery-to-go-live cycle and reduce UAT rework.',
      aiProjectIdea: 'An assistant that turns discovery notes into a structured SRS draft and tracks UAT defects against original requirements.',
      interviewObjective: 'Reconstruct the current implementation delivery workflow end-to-end, from discovery to go-live support.',
      inScopeActivities: 'Discovery\nRequirements/SRS\nDesign\nDevelopment/configuration\nTesting\nUAT\nDeployment\nPost-go-live support',
      outOfScopeActivities: 'Pre-sales/scoping\nOngoing managed hosting',
      currentSystems: 'Odoo, SharePoint, Email, WhatsApp',
      existingPainPoints: 'Requirements drift after design sign-off\nUAT defects traced back manually to original requirements',
      currentVolume: '3-5 implementation projects in progress at any time',
      currentManpower: '3 consultants, 4 developers'
    },
    process: {
      name: 'Odoo ERP Module Implementation',
      role: 'Implementation Consultant',
      trigger: 'A client signs off on an Odoo ERP or digital solution implementation',
      outcome: 'The module is deployed to production and the client team is trained and signed off through UAT',
      frequency: '3-5 implementation projects in progress at any time',
      steps: [
        { text: "Run discovery workshops to capture the client's requirements", owner: 'Consultant', systems: [] },
        { text: 'Document the requirement/SRS and get client sign-off', owner: 'Consultant', systems: ['SharePoint'] },
        { text: 'Design the solution/configuration', owner: 'Consultant', systems: ['Odoo'] },
        { text: 'Develop/configure the module and any customizations', owner: 'Developer', systems: ['Odoo'] },
        { text: 'Run internal testing against the requirement', owner: 'Developer', systems: ['Odoo'] },
        { text: 'Run User Acceptance Testing (UAT) with the client', owner: 'Consultant', systems: ['Odoo', 'Email'] },
        { text: 'Deploy to production', owner: 'Developer', systems: ['Odoo'] },
        { text: 'Provide post-go-live support and close the project', owner: 'Consultant', systems: ['Email', 'WhatsApp'] }
      ],
      systemsMentioned: ['Odoo', 'SharePoint', 'Email', 'WhatsApp'],
      deps: { client: true, manager: true },
      problems: { unclearResp: true, delays: true, rework: true },
      checkerDetail: 'Technology team lead reviews the solution design before development starts',
      rejectionHandling: 'If UAT surfaces a defect or gap, the developer fixes it and the consultant re-runs the affected test cases',
      waitDetail: 'Client-side UAT sign-off is the most common source of delay',
      exceptions: ['The requirement changes materially after design sign-off', 'A required third-party integration is unavailable or delayed'],
      knowledge: ['Standard Odoo configuration playbooks', 'UAT test case library'],
      templates: ['SRS template', 'UAT sign-off template']
    }
  },
  {
    name: 'Talent & HR Solutions',
    serviceArea: 'Talent & HR',
    project: {
      name: 'AI Recruitment Assistant',
      description: 'Understand how client staffing requests are fulfilled today, then design an AI assistant to speed up screening and compliance handoff.',
      businessObjective: 'Reduce time-to-fill and the number of shortlists rejected outright by clients.',
      aiProjectIdea: 'An assistant that screens candidates against the job description automatically and flags visa/compliance category upfront.',
      interviewObjective: 'Reconstruct the current recruitment and onboarding workflow end-to-end, including the handoff to PRO/GRO.',
      inScopeActivities: 'Requirement capture\nSourcing\nScreening\nInterview coordination\nOffer & onboarding\nCompliance handoff\nPerformance follow-up',
      outOfScopeActivities: 'Payroll processing\nVisa stamping itself (handled by PRO/GRO)',
      currentSystems: 'Excel, Email, WhatsApp, Odoo',
      existingPainPoints: 'Client interview scheduling causes the biggest delays\nNo single tracker linking recruitment to visa compliance status',
      currentVolume: '15-20 open positions in progress across clients',
      currentManpower: '3 recruitment consultants, 1 team lead'
    },
    process: {
      name: 'Client Staff Recruitment & Onboarding',
      role: 'Recruitment Consultant',
      trigger: 'A client raises a manpower requirement or vacancy request',
      outcome: 'The selected candidate is onboarded and compliant with labor/immigration requirements',
      frequency: '15-20 open positions in progress across clients',
      steps: [
        { text: 'Capture the manpower requirement and job description from the client', owner: 'Recruitment Consultant', systems: ['Email'] },
        { text: 'Source candidates through the talent database and job portals', owner: 'Recruitment Consultant', systems: [] },
        { text: 'Screen and shortlist candidates against the requirement', owner: 'Recruitment Consultant', systems: ['Excel'] },
        { text: 'Coordinate client interviews and collect feedback', owner: 'Recruitment Consultant', systems: ['WhatsApp', 'Email'] },
        { text: 'Extend the offer and collect onboarding documents', owner: 'Recruitment Consultant', systems: ['Email'] },
        { text: 'Coordinate visa/labor compliance for the new hire with the PRO/GRO team', owner: 'Recruitment Consultant', systems: [] },
        { text: 'Onboard the employee and hand over to the client', owner: 'Recruitment Consultant', systems: ['Odoo'] },
        { text: 'Follow up at 30/60/90 days on performance and fit', owner: 'Recruitment Consultant', systems: ['Excel'] }
      ],
      systemsMentioned: ['Excel', 'Email', 'WhatsApp', 'Odoo'],
      deps: { client: true, manager: true, otherDept: true },
      problems: { waiting: true, followUp: true },
      checkerDetail: 'Team lead reviews shortlists before they go to the client',
      rejectionHandling: 'If the client rejects all shortlisted candidates, the consultant revisits the requirement with the client before resourcing again',
      waitDetail: 'Waiting on client interview scheduling and feedback is the main delay',
      exceptions: [
        'The selected candidate withdraws after offer acceptance',
        "The role requires a work permit category the client hasn't budgeted for"
      ],
      knowledge: ['Role/JD library by client segment', 'Local labor law quick reference'],
      templates: ['Candidate scorecard', 'Offer letter template']
    }
  },
  {
    name: 'Office & Business Support',
    serviceArea: 'Office & Real Estate',
    project: {
      name: 'AI Workspace Activation Assistant',
      description: 'Understand how business center and virtual office activations are processed today, then design an AI assistant to speed up setup and renewals.',
      businessObjective: 'Shorten activation time and reduce missed renewal follow-ups.',
      aiProjectIdea: 'An assistant that generates the service agreement and address-use documents automatically and tracks renewal dates.',
      interviewObjective: 'Reconstruct the current workspace activation workflow end-to-end, including renewal tracking.',
      inScopeActivities: 'Requirement capture\nAvailability check\nProposal\nAgreement\nSetup\nActivation\nBilling\nRenewal',
      outOfScopeActivities: 'Physical facilities maintenance\nReal estate brokerage for external properties',
      currentSystems: 'Odoo, Excel, Email',
      existingPainPoints: 'Manual occupancy tracking in Excel\nPricing exceptions need manual escalation\nRenewal follow-up sometimes missed',
      currentVolume: '10-15 workspace activations / month',
      currentManpower: '2 office services coordinators, 1 team lead'
    },
    process: {
      name: 'Virtual Office Setup & Activation',
      role: 'Office Services Coordinator',
      trigger: 'A client requests a business center, virtual office, or shared workspace service',
      outcome: 'The workspace/service is activated and the client receives their address-use and access documentation',
      frequency: '10-15 workspace activations per month',
      steps: [
        { text: "Capture the client's workspace requirement (virtual, shared, dedicated)", owner: 'Office Services Coordinator', systems: ['Email'] },
        { text: 'Check availability against current occupancy', owner: 'Office Services Coordinator', systems: ['Excel'] },
        { text: 'Send the client a proposal with pricing and terms', owner: 'Office Services Coordinator', systems: ['Email'] },
        { text: 'Prepare and sign the service agreement', owner: 'Office Services Coordinator', systems: ['Odoo'] },
        { text: 'Set up the workspace/address and access credentials', owner: 'Office Services Coordinator', systems: [] },
        { text: 'Activate the service and issue address-use documentation for licensing', owner: 'Office Services Coordinator', systems: ['Odoo'] },
        { text: 'Set up recurring billing for the service', owner: 'Office Services Coordinator', systems: ['Odoo'] },
        { text: 'Track the renewal date and re-engage the client ahead of expiry', owner: 'Office Services Coordinator', systems: ['Excel'] }
      ],
      systemsMentioned: ['Odoo', 'Excel', 'Email'],
      deps: { client: true, manager: true },
      problems: { followUp: true, noChecklist: true },
      checkerDetail: 'Team lead approves pricing exceptions before the agreement is signed',
      rejectionHandling: 'If the client requests terms outside standard pricing, the coordinator escalates to the team lead for approval before proceeding',
      waitDetail: 'Waiting on the signed agreement and payment before activation',
      exceptions: [
        'The client needs address-use documentation urgently for a licensing deadline',
        'The requested workspace type is fully occupied'
      ],
      knowledge: ['Occupancy and pricing sheet', 'Address-use documentation requirements by authority'],
      templates: ['Service agreement template', 'Renewal reminder template']
    }
  }
];

function buildSampleInterviewState(division: ServiceDivisionSeed): InterviewState {
  const state = newInterviewState('en');
  const { process } = division;

  state.department = division.name;
  state.role = process.role;
  state.name = process.name;
  state.trigger = process.trigger;
  state.outcome = process.outcome;
  state.frequency = process.frequency;
  state.steps = process.steps as InterviewStep[];
  state.systemsMentioned = Object.fromEntries(process.systemsMentioned.map((s) => [s, true as const]));
  state.checker = 'manager';
  state.checkerDetail = process.checkerDetail;
  state.rejectionHandling = process.rejectionHandling;
  state.waitDetail = process.waitDetail;
  state.deps = { ...state.deps, ...process.deps };
  state.problems = { ...state.problems, ...process.problems };
  state.exceptions = process.exceptions;
  state.knowledge = process.knowledge;
  state.templates = process.templates;
  state.aiObservations = process.aiObservations ?? [];
  state.dims = { start: 100, workflow: 100, roles: 100, systems: 100, controls: 100, waiting: 100, exceptions: 100, knowledge: 100, aiOpp: 100, kpis: 100 };
  state.completeness = 100;
  state.completed = true;
  state.stage = 'complete';

  return state;
}

async function main() {
  console.log('Seeding organization structure…');

  const org = await prisma.organization.upsert({
    where: { id: 'seed-org-analytix' },
    update: {},
    create: { id: 'seed-org-analytix', name: 'Analytix Group' }
  });

  const country = await prisma.country.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'United Arab Emirates' } },
    update: {},
    create: { organizationId: org.id, name: 'United Arab Emirates', isoCode: 'AE' }
  });

  console.log('Seeding demo users…');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const createdUsers: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        jobTitle: u.jobTitle,
        passwordHash,
        isDemoUser: true,
        organizationId: org.id
      }
    });
    createdUsers[u.role] = user.id;
  }

  console.log('Seeding the 10 Analytix service divisions (spec section 62 + sample processes/SOPs)…');
  const processOwnerId = createdUsers['PROCESS_OWNER'];
  const interviewEmployeeId = createdUsers['EMPLOYEE'];

  for (const division of SERVICE_DIVISIONS) {
    const divisionRecord = await prisma.division.upsert({
      where: { countryId_name: { countryId: country.id, name: division.name } },
      update: {},
      create: { countryId: country.id, name: division.name }
    });

    const department = await prisma.department.upsert({
      where: { divisionId_name: { divisionId: divisionRecord.id, name: division.name } },
      update: {},
      create: {
        name: division.name,
        serviceArea: division.serviceArea,
        divisionId: divisionRecord.id,
        departmentHeadId: division.departmentHead ? createdUsers[division.departmentHead] : null
      }
    });

    let project = await prisma.aiTransformationProject.findFirst({
      where: { name: division.project.name, departmentId: department.id }
    });
    if (!project) {
      project = await prisma.aiTransformationProject.create({
        data: {
          name: division.project.name,
          description: division.project.description,
          organizationId: org.id,
          departmentId: department.id,
          processOwnerId,
          service: division.serviceArea,
          businessObjective: division.project.businessObjective,
          aiProjectIdea: division.project.aiProjectIdea,
          interviewObjective: division.project.interviewObjective,
          inScopeActivities: division.project.inScopeActivities,
          outOfScopeActivities: division.project.outOfScopeActivities,
          currentSystems: division.project.currentSystems,
          existingPainPoints: division.project.existingPainPoints,
          currentVolume: division.project.currentVolume,
          currentManpower: division.project.currentManpower
        }
      });
    }

    let process = await prisma.process.findFirst({ where: { projectId: project.id, name: division.process.name } });
    if (!process) {
      process = await prisma.process.create({
        data: {
          projectId: project.id,
          name: division.process.name,
          department: division.name,
          status: 'COMPLETE',
          createdById: processOwnerId
        }
      });

      const state = buildSampleInterviewState(division);
      const interview = await prisma.interview.create({
        data: {
          processId: process.id,
          employeeId: interviewEmployeeId,
          language: 'en',
          status: 'COMPLETED',
          stateJson: JSON.stringify(state),
          completeness: 100,
          completedAt: new Date()
        }
      });

      const facts = extractProcessFacts(state);
      const contentMd = generateSopMarkdown({
        processName: division.process.name,
        departmentName: division.name,
        projectName: project.name,
        employeeName: DEMO_USERS.find((u) => u.role === 'EMPLOYEE')!.name,
        facts,
        generatedAt: new Date()
      });

      await prisma.sop.create({
        data: {
          processId: process.id,
          title: division.process.name,
          contentMd,
          status: 'PUBLISHED',
          sourceInterviewId: interview.id,
          generatedById: processOwnerId
        }
      });
    }
  }

  console.log('\nSeed complete. Demo login (any account, password: %s):', DEMO_PASSWORD);
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(28)} ${u.email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
