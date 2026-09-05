// Phase 2 — AI Interview engine.
//
// This is a deterministic, rule-based port of the interview logic from the Phase 0 HTML
// prototype (analytix-ai-process-consultant.html): the same keyword-detection regexes, the same
// adaptive question-branching state machine, the same AI-observation derivation. It operates on
// a plain, JSON-serializable state object (persisted as Interview.stateJson) instead of mutating
// the DOM directly, so it can run inside a Next.js server action.
//
// This module has NO real LLM call in it by design (Phase 2 decision: rule-based engine only).
// It is written as a self-contained "engine" so a later phase can swap in a real LLM behind the
// same `beginInterview` / `submitAnswer` / `resolveObservation` entry points without changing any
// caller — see README's Phase 2+ notes.

export type Language = 'en' | 'hi' | 'ar' | 'zh' | 'ml';

export type ObservationCategory = 'OBSERVATION' | 'BOTTLENECK' | 'KNOWLEDGE_RISK';

export type PendingObservation = {
  key: string;
  category: ObservationCategory;
  text: string;
};

export type InterviewStep = {
  text: string;
  owner: string;
  systems: string[];
};

export type DimKey =
  | 'start'
  | 'workflow'
  | 'roles'
  | 'systems'
  | 'controls'
  | 'waiting'
  | 'exceptions'
  | 'knowledge'
  | 'aiOpp'
  | 'kpis';

export type InterviewState = {
  language: Language;
  stage: string;
  lastQKey: string | null;
  walkStepCount: number;
  duplicateAsked: boolean;
  pendingClar: string[];
  pendingObs: PendingObservation[];

  department: string | null;
  role: string | null;
  mainActivities: string | null;
  name: string | null;
  trigger: string | null;
  outcome: string | null;
  frequency: string | null;

  steps: InterviewStep[];
  systemsMentioned: Record<string, true>;

  checker: string | null;
  checkerDetail: string | null;
  rejectionHandling: string | null;
  waitDetail: string | null;

  deps: {
    client: boolean;
    otherDept: boolean;
    otherDeptDetail: string | null;
    manager: boolean;
    authority: boolean;
    vendor: boolean;
    external: boolean;
  };
  problems: {
    manualWork: boolean;
    repeatedEntry: boolean;
    waiting: boolean;
    followUp: boolean;
    missingDocs: boolean;
    errors: boolean;
    rework: boolean;
    delays: boolean;
    unclearResp: boolean;
    noChecklist: boolean;
  };

  exceptions: string[];
  knowledge: string[];
  templates: string[];
  confirmedFacts: string[];
  aiObservations: { text: string; status: string; key: string }[];
  needsConfirmation: string[];
  obsGiven: Record<string, boolean>;

  dims: Record<DimKey, number>;
  completeness: number;

  transcript: { q: string | null; a: string }[];
  completed: boolean;
};

export type EngineAction =
  | { kind: 'ai_message'; text: string; questionKey: string }
  | { kind: 'observation'; observationKey: string; category: ObservationCategory; text: string }
  | { kind: 'summary'; introText: string; summaryText: string }
  | { kind: 'completed'; text: string };

/* ============================================================
   i18n — only the strings the interview flow actually uses.
   Ported verbatim (including all 5 languages) from the HTML prototype's I18N object.
   ============================================================ */
type Dict = Record<string, string>;

const I18N: Record<Language, Dict> = {
  en: {
    intro:
      "Hello. I'm Alex, your Analytix AI Process Consultant.\n\nI'm going to understand how you actually perform your work today. You don't need to prepare an SOP or use any technical language — just explain your work the same way you would explain it to a new employee.\n\nI'll ask one question at a time.",
    qDepartment: 'To start, which department do you work in?',
    qRole: 'Thank you. What is your role in that department?',
    qActivities: 'What are the main activities you personally handle, day to day?',
    qProcessName:
      "Which process should we understand first? Just give it a simple name (for example, 'Premium Residency' or 'Vendor Payments').",
    qTrigger:
      'What normally happens right before you start working on a new case for this process — what starts it off?',
    qFirstStep: "Let's take one recent, normal case you completed for this process. What happened first?",
    qNext: 'Good. What did you do next?',
    qAfterThat: 'And what happened after that?',
    qContinue: 'What happened next?',
    qIsThatAll: 'Is that the end of the process, or does something else usually happen after this?',
    qOutcome: 'What actually marks this process as finished — what tells you the case is closed?',
    qFrequency: 'Roughly how many of these cases would you personally handle in a typical week or month?',
    qCheckerMissing: "Does anyone check or approve this before it's considered final?",
    qCheckerWhat:
      'Understood. To document this correctly, what does the manager (or approver) normally check before approving the case?',
    qRejection: 'What happens if it gets rejected or sent back — what do you do then?',
    qSubmitWhere: 'Where is it submitted — through a government portal, email, Odoo, or another system?',
    qDuplicateAsk: 'Do employees enter or copy the same client information into more than one of these systems?',
    qDuplicateWhich: 'Which information is usually repeated between them?',
    qMissingDocWhat: 'What happens when a required document is missing?',
    qMissingDocWho: 'Who follows up with the client about it?',
    qMissingDocHow: 'How do they follow up today — WhatsApp, email, phone, a system activity, or another method?',
    qAuthorityManual: 'Does someone manually check the portal for updates?',
    qUrgentDiff: 'What is different about how you handle urgent or priority cases?',
    qWaitWhere: 'Which part of this process normally takes the longest to wait for, and roughly how long does it take?',
    qWaitingGeneral: 'Are there any points in this process where you have to wait for someone or something before you can continue?',
    qOtherDeptDetail: 'Which other department is involved, and what do you need from them?',
    qExceptions:
      'Are there any special cases — urgent requests, VIP clients, renewals, or different customer/country requirements — that are handled differently from a normal case?',
    qKnowledge1:
      "Is there anything experienced staff know about handling this process that isn't written down anywhere — special checks, common mistakes, or things a new employee wouldn't know?",
    qKnowledge2: 'Do you use any standard templates, checklists, or email formats for this process?',
    qCorrectionWhat: 'No problem — what should we correct or add?',
    obsDuplicateEntry:
      'I noticed the same client information may be entered or copied into more than one system.\n\nIs that correct?',
    obsDocDependency:
      'It sounds like this process depends heavily on receiving documents from the client, and that this may be a source of delay.\n\nWould you say client document collection is one of the main reasons for delay?',
    obsKnowledgeRisk:
      "You mentioned that experienced employees know how to handle certain situations, but this isn't written down anywhere.\n\nThis may be important process knowledge worth documenting formally. Does that sound right?",
    obsManualFollowUp:
      'It sounds like following up on missing information or status updates is done manually today.\n\nIs that a fair description?',
    obsAuthorityCheck:
      'It sounds like someone manually checks a government portal or external system for status updates, rather than being notified automatically.\n\nIs that correct?',
    obsBottleneckGeneral:
      "Based on what you've described, waiting and follow-up may be adding significant time to this process.\n\nWould you agree this is one of the bigger sources of delay?",
    tagObservation: 'AI Observation',
    tagBottleneck: 'Possible Bottleneck',
    tagKnowledge: 'Knowledge Risk',
    tagSummary: 'Process Summary',
    btnYes: 'Yes',
    btnPartly: 'Partly',
    btnNo: 'No',
    btnConfirm: 'Confirm',
    btnCorrection: 'Need Correction',
    summaryIntro: 'Before I prepare the final process report, here is what I understand so far:',
    summaryAskCorrect: 'Is this broadly correct?',
    thanksConfirmed: 'Thank you — confirmed.',
    completionMsg:
      'Your interview is complete. The captured process details, steps and confirmed observations are saved below.',
    label_process: 'Process',
    label_department: 'Department',
    label_start: 'Start',
    label_mainflow: 'Main flow',
    label_delay: 'Main delay',
    label_systems: 'Main systems',
    label_controls: 'Main controls',
    needCorrectionPrompt: "Understood — let's refine it. What would you like to correct or add?",
    inputPlaceholder: 'Type your answer...',
    langName: 'English'
  },
  hi: {
    intro:
      'नमस्ते। मैं एलेक्स हूं, आपका Analytix AI प्रोसेस कंसल्टेंट।\n\nमैं यह समझने की कोशिश करूंगा कि आप आज अपना काम वास्तव में कैसे करते हैं। आपको SOP तैयार करने या किसी तकनीकी भाषा का उपयोग करने की आवश्यकता नहीं है — बस अपना काम वैसे ही समझाएं जैसे आप किसी नए कर्मचारी को समझाते।\n\nमैं एक-एक करके सवाल पूछूंगा।',
    qDepartment: 'शुरुआत के लिए, आप किस विभाग में काम करते हैं?',
    qRole: 'धन्यवाद। उस विभाग में आपकी भूमिका क्या है?',
    qActivities: 'आप रोज़ाना मुख्य रूप से कौन-कौन से काम खुद संभालते हैं?',
    qProcessName: "हमें सबसे पहले किस प्रक्रिया को समझना चाहिए? बस एक सरल नाम बताएं (जैसे 'प्रीमियम रेजिडेंसी')।",
    qTrigger: 'इस प्रक्रिया के लिए एक नया केस शुरू करने से ठीक पहले आमतौर पर क्या होता है?',
    qFirstStep: 'एक हाल की, सामान्य केस के बारे में सोचें जिसे आपने इस प्रक्रिया के लिए पूरा किया। सबसे पहले क्या हुआ?',
    qNext: 'अच्छा। उसके बाद आपने क्या किया?',
    qAfterThat: 'और उसके बाद क्या हुआ?',
    qContinue: 'फिर आगे क्या हुआ?',
    qIsThatAll: 'क्या यह प्रक्रिया का अंत है, या इसके बाद आमतौर पर कुछ और होता है?',
    qOutcome: 'इस प्रक्रिया के पूरा होने का संकेत क्या है — आपको कैसे पता चलता है कि केस बंद हो गया?',
    qFrequency: 'आप आमतौर पर एक सप्ताह या महीने में लगभग कितने ऐसे केस संभालते हैं?',
    qCheckerMissing: 'क्या इसे अंतिम मानने से पहले कोई इसकी जांच या स्वीकृति देता है?',
    qCheckerWhat: 'समझ गया। सही ढंग से दस्तावेज़ करने के लिए, मैनेजर (या स्वीकृतिकर्ता) आमतौर पर स्वीकृति देने से पहले क्या जांचते हैं?',
    qRejection: 'अगर यह अस्वीकृत हो जाए या वापस भेजा जाए तो क्या होता है — आप तब क्या करते हैं?',
    qSubmitWhere: 'यह कहाँ सबमिट किया जाता है — सरकारी पोर्टल, ईमेल, Odoo, या किसी अन्य सिस्टम के माध्यम से?',
    qDuplicateAsk: 'क्या कर्मचारी एक ही क्लाइंट जानकारी को एक से अधिक सिस्टम में दर्ज या कॉपी करते हैं?',
    qDuplicateWhich: 'आमतौर पर इनके बीच कौन सी जानकारी दोहराई जाती है?',
    qMissingDocWhat: 'जब कोई आवश्यक दस्तावेज़ गायब होता है तो क्या होता है?',
    qMissingDocWho: 'इसके बारे में क्लाइंट से कौन फॉलो-अप करता है?',
    qMissingDocHow: 'वे आज कैसे फॉलो-अप करते हैं — WhatsApp, ईमेल, फोन, सिस्टम गतिविधि, या कोई अन्य तरीका?',
    qAuthorityManual: 'क्या कोई मैन्युअल रूप से पोर्टल पर अपडेट के लिए जांच करता है?',
    qUrgentDiff: 'अत्यावश्यक या प्राथमिकता वाले केस को संभालने में क्या अलग है?',
    qWaitWhere: 'इस प्रक्रिया का कौन सा हिस्सा आमतौर पर प्रतीक्षा में सबसे अधिक समय लेता है, और लगभग कितना समय लगता है?',
    qWaitingGeneral: 'क्या इस प्रक्रिया में कोई ऐसा बिंदु है जहाँ आपको आगे बढ़ने से पहले किसी का या किसी चीज़ का इंतज़ार करना पड़ता है?',
    qOtherDeptDetail: 'कौन सा अन्य विभाग शामिल है, और आपको उनसे क्या चाहिए?',
    qExceptions:
      'क्या कोई विशेष मामले हैं — अत्यावश्यक अनुरोध, VIP क्लाइंट, नवीनीकरण, या अलग ग्राहक/देश आवश्यकताएं — जिन्हें सामान्य केस से अलग तरीके से संभाला जाता है?',
    qKnowledge1:
      'क्या अनुभवी कर्मचारी इस प्रक्रिया को संभालने के बारे में कुछ ऐसा जानते हैं जो कहीं लिखा नहीं है — विशेष जांच, सामान्य गलतियां, या ऐसी बातें जो एक नया कर्मचारी नहीं जानता होगा?',
    qKnowledge2: 'क्या आप इस प्रक्रिया के लिए किसी मानक टेम्पलेट, चेकलिस्ट, या ईमेल प्रारूप का उपयोग करते हैं?',
    qCorrectionWhat: 'कोई बात नहीं — हमें क्या सुधारना या जोड़ना चाहिए?',
    obsDuplicateEntry: 'मैंने देखा कि एक ही क्लाइंट जानकारी को एक से अधिक सिस्टम में दर्ज या कॉपी किया जा सकता है।\n\nक्या यह सही है?',
    obsDocDependency:
      'ऐसा लगता है कि यह प्रक्रिया क्लाइंट से दस्तावेज़ प्राप्त करने पर बहुत निर्भर करती है, और यह देरी का एक स्रोत हो सकता है।\n\nक्या आप कहेंगे कि क्लाइंट दस्तावेज़ संग्रह देरी के मुख्य कारणों में से एक है?',
    obsKnowledgeRisk:
      'आपने बताया कि अनुभवी कर्मचारी कुछ स्थितियों को संभालना जानते हैं, लेकिन यह कहीं लिखा नहीं है।\n\nयह दस्तावेज़ीकरण के लिए महत्वपूर्ण प्रक्रिया ज्ञान हो सकता है। क्या यह सही लगता है?',
    obsManualFollowUp: 'ऐसा लगता है कि गुम जानकारी या स्थिति अपडेट पर फॉलो-अप आज मैन्युअल रूप से किया जाता है।\n\nक्या यह एक उचित विवरण है?',
    obsAuthorityCheck:
      'ऐसा लगता है कि कोई मैन्युअल रूप से सरकारी पोर्टल या बाहरी सिस्टम की स्थिति जांचता है, बजाय स्वचालित रूप से सूचित होने के।\n\nक्या यह सही है?',
    obsBottleneckGeneral:
      'आपने जो बताया उसके आधार पर, प्रतीक्षा और फॉलो-अप इस प्रक्रिया में महत्वपूर्ण समय जोड़ सकते हैं।\n\nक्या आप सहमत हैं कि यह देरी के बड़े स्रोतों में से एक है?',
    tagObservation: 'AI अवलोकन',
    tagBottleneck: 'संभावित बाधा',
    tagKnowledge: 'ज्ञान जोखिम',
    tagSummary: 'प्रक्रिया सारांश',
    btnYes: 'हां',
    btnPartly: 'आंशिक रूप से',
    btnNo: 'नहीं',
    btnConfirm: 'पुष्टि करें',
    btnCorrection: 'सुधार चाहिए',
    summaryIntro: 'अंतिम प्रक्रिया रिपोर्ट तैयार करने से पहले, यहाँ बताया गया है कि मैं अब तक क्या समझता हूँ:',
    summaryAskCorrect: 'क्या यह मोटे तौर पर सही है?',
    thanksConfirmed: 'धन्यवाद — पुष्टि हो गई।',
    completionMsg: 'आपका इंटरव्यू पूरा हो गया है। कैप्चर किए गए प्रोसेस विवरण, चरण और पुष्ट अवलोकन नीचे सहेजे गए हैं।',
    label_process: 'प्रक्रिया',
    label_department: 'विभाग',
    label_start: 'शुरुआत',
    label_mainflow: 'मुख्य प्रवाह',
    label_delay: 'मुख्य देरी',
    label_systems: 'मुख्य सिस्टम',
    label_controls: 'मुख्य नियंत्रण',
    needCorrectionPrompt: 'ठीक है — चलिए इसे परिष्कृत करते हैं। आप क्या सुधारना या जोड़ना चाहेंगे?',
    inputPlaceholder: 'अपना उत्तर लिखें...',
    langName: 'हिन्दी'
  },
  ar: {
    intro:
      'مرحباً. أنا أليكس، مستشار العمليات بالذكاء الاصطناعي من Analytix.\n\nسأحاول فهم كيف تؤدي عملك فعلياً اليوم. لست بحاجة لإعداد إجراء تشغيل موحد أو استخدام أي مصطلحات تقنية — فقط اشرح عملك كما لو كنت تشرحه لموظف جديد.\n\nسأطرح سؤالاً واحداً في كل مرة.',
    qDepartment: 'بداية، في أي قسم تعمل؟',
    qRole: 'شكراً. ما هو دورك في هذا القسم؟',
    qActivities: 'ما هي الأنشطة الرئيسية التي تتولاها بنفسك يومياً؟',
    qProcessName: "ما هي العملية التي يجب أن نفهمها أولاً؟ فقط أعطها اسماً بسيطاً (مثل 'الإقامة المميزة').",
    qTrigger: 'ماذا يحدث عادةً قبل أن تبدأ العمل على حالة جديدة لهذه العملية؟',
    qFirstStep: 'فكر في حالة عادية وحديثة أكملتها لهذه العملية. ماذا حدث أولاً؟',
    qNext: 'جيد. ماذا فعلت بعد ذلك؟',
    qAfterThat: 'وماذا حدث بعد ذلك؟',
    qContinue: 'ثم ماذا حدث بعد ذلك؟',
    qIsThatAll: 'هل هذه نهاية العملية، أم يحدث شيء آخر عادةً بعد ذلك؟',
    qOutcome: 'ما الذي يشير إلى انتهاء هذه العملية فعلياً — كيف تعرف أن الحالة أُغلقت؟',
    qFrequency: 'تقريباً كم حالة من هذا النوع تتعامل معها شخصياً في أسبوع أو شهر عادي؟',
    qCheckerMissing: 'هل يقوم أحد بفحص أو الموافقة على هذا قبل اعتباره نهائياً؟',
    qCheckerWhat: 'فهمت. لتوثيق ذلك بشكل صحيح، ماذا يتحقق المدير (أو الموافق) عادةً قبل الموافقة على الحالة؟',
    qRejection: 'ماذا يحدث إذا تم رفضها أو إعادتها — ماذا تفعل حينها؟',
    qSubmitWhere: 'أين يتم تقديمها — عبر بوابة حكومية، بريد إلكتروني، Odoo، أو نظام آخر؟',
    qDuplicateAsk: 'هل يقوم الموظفون بإدخال أو نسخ نفس معلومات العميل في أكثر من نظام واحد؟',
    qDuplicateWhich: 'ما هي المعلومات التي تتكرر عادةً بينها؟',
    qMissingDocWhat: 'ماذا يحدث عندما يكون مستند مطلوب مفقوداً؟',
    qMissingDocWho: 'من يتابع مع العميل بخصوص ذلك؟',
    qMissingDocHow: 'كيف يتابعون اليوم — واتساب، بريد إلكتروني، هاتف، نشاط في النظام، أم طريقة أخرى؟',
    qAuthorityManual: 'هل يقوم أحد بفحص البوابة يدوياً للتحديثات؟',
    qUrgentDiff: 'ما الذي يختلف في طريقة التعامل مع الحالات العاجلة أو ذات الأولوية؟',
    qWaitWhere: 'أي جزء من هذه العملية يستغرق عادةً أطول وقت انتظار، وكم يستغرق تقريباً؟',
    qWaitingGeneral: 'هل هناك أي نقاط في هذه العملية يجب أن تنتظر فيها شخصاً أو شيئاً قبل أن تتمكن من المتابعة؟',
    qOtherDeptDetail: 'ما هو القسم الآخر المعني، وماذا تحتاج منه؟',
    qExceptions:
      'هل هناك حالات خاصة — طلبات عاجلة، عملاء VIP، تجديدات، أو متطلبات عملاء/دول مختلفة — تُعامل بشكل مختلف عن الحالة العادية؟',
    qKnowledge1:
      'هل هناك أمر يعرفه الموظفون ذوو الخبرة حول التعامل مع هذه العملية وغير مكتوب في أي مكان — فحوصات خاصة، أخطاء شائعة، أو أمور لا يعرفها موظف جديد؟',
    qKnowledge2: 'هل تستخدمون أي نماذج أو قوائم تحقق أو صيغ بريد إلكتروني موحدة لهذه العملية؟',
    qCorrectionWhat: 'لا مشكلة — ماذا يجب أن نصحح أو نضيف؟',
    obsDuplicateEntry: 'لاحظت أن نفس معلومات العميل قد تُدخل أو تُنسخ في أكثر من نظام واحد.\n\nهل هذا صحيح؟',
    obsDocDependency:
      'يبدو أن هذه العملية تعتمد بشكل كبير على استلام مستندات من العميل، وأن هذا قد يكون مصدر تأخير.\n\nهل تقول إن جمع مستندات العميل هو أحد الأسباب الرئيسية للتأخير؟',
    obsKnowledgeRisk:
      'ذكرت أن الموظفين ذوي الخبرة يعرفون كيفية التعامل مع مواقف معينة، لكن هذا غير مدوّن في أي مكان.\n\nقد تكون هذه معرفة مهمة تستحق التوثيق. هل هذا صحيح؟',
    obsManualFollowUp: 'يبدو أن متابعة المعلومات الناقصة أو تحديثات الحالة تتم يدوياً اليوم.\n\nهل هذا وصف دقيق؟',
    obsAuthorityCheck:
      'يبدو أن أحداً يفحص يدوياً بوابة حكومية أو نظاماً خارجياً للتحديثات، بدلاً من تلقي إشعار تلقائي.\n\nهل هذا صحيح؟',
    obsBottleneckGeneral:
      'بناءً على ما وصفته، قد يضيف الانتظار والمتابعة وقتاً كبيراً لهذه العملية.\n\nهل توافق أن هذا أحد أكبر مصادر التأخير؟',
    tagObservation: 'ملاحظة الذكاء الاصطناعي',
    tagBottleneck: 'اختناق محتمل',
    tagKnowledge: 'مخاطرة معرفية',
    tagSummary: 'ملخص العملية',
    btnYes: 'نعم',
    btnPartly: 'جزئياً',
    btnNo: 'لا',
    btnConfirm: 'تأكيد',
    btnCorrection: 'بحاجة لتصحيح',
    summaryIntro: 'قبل إعداد التقرير النهائي للعملية، إليك ما فهمته حتى الآن:',
    summaryAskCorrect: 'هل هذا صحيح بشكل عام؟',
    thanksConfirmed: 'شكراً — تم التأكيد.',
    completionMsg: 'اكتملت المقابلة. تم حفظ تفاصيل العملية والخطوات والملاحظات المؤكدة أدناه.',
    label_process: 'العملية',
    label_department: 'القسم',
    label_start: 'البداية',
    label_mainflow: 'التدفق الرئيسي',
    label_delay: 'التأخير الرئيسي',
    label_systems: 'الأنظمة الرئيسية',
    label_controls: 'الضوابط الرئيسية',
    needCorrectionPrompt: 'حسناً — لنقم بتحسينها. ما الذي تود تصحيحه أو إضافته؟',
    inputPlaceholder: 'اكتب إجابتك...',
    langName: 'العربية'
  },
  zh: {
    intro:
      '您好。我是 Alex，Analytix 的人工智能流程顾问。\n\n我将了解您今天实际是如何完成工作的。您不需要准备标准作业程序，也不需要使用任何技术术语——只需像向新员工解释一样说明您的工作即可。\n\n我会一次问一个问题。',
    qDepartment: '首先，您在哪个部门工作？',
    qRole: '谢谢。您在该部门的职位是什么？',
    qActivities: '您每天主要亲自处理哪些工作？',
    qProcessName: '我们应该先了解哪个流程？请给它起一个简单的名字（例如"高级居留权"）。',
    qTrigger: '在您开始处理这个流程的新案例之前，通常会发生什么？',
    qFirstStep: '想一个您最近为此流程完成的普通案例。首先发生了什么？',
    qNext: '好的。接下来您做了什么？',
    qAfterThat: '然后发生了什么？',
    qContinue: '然后呢？',
    qIsThatAll: '这就是流程的结束了吗，还是之后通常还会发生别的事情？',
    qOutcome: '什么标志着这个流程真正完成——您怎么知道案子结案了？',
    qFrequency: '您个人大约每周或每月处理多少这样的案子？',
    qCheckerMissing: '在最终确定之前，是否有人检查或批准？',
    qCheckerWhat: '明白了。为了正确记录，经理（或审批人）在批准之前通常会检查什么？',
    qRejection: '如果被拒绝或退回会怎样——您接下来会怎么做？',
    qSubmitWhere: '提交到哪里——政府门户网站、电子邮件、Odoo，还是其他系统？',
    qDuplicateAsk: '员工是否会将相同的客户信息输入或复制到多个系统中？',
    qDuplicateWhich: '通常哪些信息会在它们之间重复？',
    qMissingDocWhat: '当缺少所需文件时会发生什么？',
    qMissingDocWho: '谁来跟进客户？',
    qMissingDocHow: '他们现在如何跟进——WhatsApp、电子邮件、电话、系统活动，还是其他方式？',
    qAuthorityManual: '是否有人手动检查门户网站的更新？',
    qUrgentDiff: '处理紧急或优先案件有什么不同？',
    qWaitWhere: '这个流程的哪个部分通常等待时间最长，大约需要多长时间？',
    qWaitingGeneral: '这个流程中是否有需要等待某人或某事才能继续的环节？',
    qOtherDeptDetail: '涉及哪个其他部门，您需要他们提供什么？',
    qExceptions: '是否有特殊情况——紧急请求、VIP客户、续期，或不同的客户/国家要求——需要与普通案例不同的处理方式？',
    qKnowledge1: '是否有经验丰富的员工知道如何处理某些情况，但这些知识没有被记录下来——特殊检查、常见错误，或新员工不知道的事情？',
    qKnowledge2: '您是否为此流程使用任何标准模板、检查清单或电子邮件格式？',
    qCorrectionWhat: '没问题——我们应该更正或补充什么？',
    obsDuplicateEntry: '我注意到相同的客户信息可能被输入或复制到多个系统中。\n\n这样对吗？',
    obsDocDependency: '听起来这个流程在很大程度上依赖于从客户那里收到文件，这可能是延误的原因之一。\n\n您认为客户文件收集是延误的主要原因之一吗？',
    obsKnowledgeRisk: '您提到经验丰富的员工知道如何处理某些情况，但这没有记录在任何地方。\n\n这可能是值得正式记录的重要流程知识。这样理解对吗？',
    obsManualFollowUp: '听起来目前跟进缺失信息或状态更新是手动完成的。\n\n这样描述准确吗？',
    obsAuthorityCheck: '听起来有人手动检查政府门户网站或外部系统的更新，而不是自动收到通知。\n\n这样对吗？',
    obsBottleneckGeneral: '根据您的描述，等待和跟进可能会给这个流程增加大量时间。\n\n您是否同意这是延误的主要原因之一？',
    tagObservation: 'AI 观察',
    tagBottleneck: '可能的瓶颈',
    tagKnowledge: '知识风险',
    tagSummary: '流程摘要',
    btnYes: '是',
    btnPartly: '部分',
    btnNo: '否',
    btnConfirm: '确认',
    btnCorrection: '需要更正',
    summaryIntro: '在准备最终流程报告之前，以下是我目前的理解：',
    summaryAskCorrect: '这大体上正确吗？',
    thanksConfirmed: '谢谢——已确认。',
    completionMsg: '访谈已完成。已记录的流程详情、步骤和已确认的观察结果保存在下方。',
    label_process: '流程',
    label_department: '部门',
    label_start: '开始',
    label_mainflow: '主流程',
    label_delay: '主要延误',
    label_systems: '主要系统',
    label_controls: '主要控制',
    needCorrectionPrompt: '好的——我们来完善它。您想更正或补充什么？',
    inputPlaceholder: '请输入您的回答...',
    langName: '中文'
  },
  ml: {
    intro:
      'ഹലോ. ഞാൻ അലക്സ്, നിങ്ങളുടെ Analytix AI പ്രോസസ് കൺസൾട്ടന്റ്.\n\nഇന്ന് നിങ്ങൾ യഥാർത്ഥത്തിൽ എങ്ങനെയാണ് ജോലി ചെയ്യുന്നത് എന്ന് മനസ്സിലാക്കാൻ ഞാൻ ശ്രമിക്കും. SOP തയ്യാറാക്കുകയോ സാങ്കേതിക ഭാഷ ഉപയോഗിക്കുകയോ വേണ്ട — ഒരു പുതിയ ജീവനക്കാരനോട് വിശദീകരിക്കുന്നത് പോലെ നിങ്ങളുടെ ജോലി വിശദീകരിച്ചാൽ മതി.\n\nഞാൻ ഒരു സമയം ഒരു ചോദ്യം ചോദിക്കും.',
    qDepartment: 'തുടങ്ങാൻ, നിങ്ങൾ ഏത് ഡിപ്പാർട്ട്മെന്റിലാണ് ജോലി ചെയ്യുന്നത്?',
    qRole: 'നന്ദി. ആ ഡിപ്പാർട്ട്മെന്റിൽ നിങ്ങളുടെ റോൾ എന്താണ്?',
    qActivities: 'നിങ്ങൾ ദിവസവും പ്രധാനമായും കൈകാര്യം ചെയ്യുന്ന പ്രവർത്തനങ്ങൾ ഏതൊക്കെയാണ്?',
    qProcessName: "ആദ്യം ഏത് പ്രോസസ് ആണ് നമ്മൾ മനസ്സിലാക്കേണ്ടത്? ഒരു ലളിതമായ പേര് നൽകുക (ഉദാ. 'പ്രീമിയം റെസിഡൻസി').",
    qTrigger: 'ഈ പ്രോസസിനായി ഒരു പുതിയ കേസ് തുടങ്ങുന്നതിന് തൊട്ടുമുമ്പ് സാധാരണയായി എന്താണ് സംഭവിക്കുന്നത്?',
    qFirstStep: 'ഈ പ്രോസസിനായി നിങ്ങൾ അടുത്തിടെ പൂർത്തിയാക്കിയ ഒരു സാധാരണ കേസ് ഓർക്കുക. ആദ്യം എന്താണ് സംഭവിച്ചത്?',
    qNext: 'നല്ലത്. അതിനുശേഷം നിങ്ങൾ എന്ത് ചെയ്തു?',
    qAfterThat: 'പിന്നെ എന്ത് സംഭവിച്ചു?',
    qContinue: 'പിന്നീട് എന്ത് സംഭവിച്ചു?',
    qIsThatAll: 'ഇത് പ്രോസസിന്റെ അവസാനമാണോ, അതോ ഇതിനുശേഷം സാധാരണയായി മറ്റെന്തെങ്കിലും സംഭവിക്കാറുണ്ടോ?',
    qOutcome: 'ഈ പ്രോസസ് പൂർത്തിയായി എന്നതിന്റെ യഥാർത്ഥ സൂചന എന്താണ് — കേസ് ക്ലോസ് ആയി എന്ന് നിങ്ങൾക്ക് എങ്ങനെ അറിയാം?',
    qFrequency: 'ഒരു സാധാരണ ആഴ്ചയിലോ മാസത്തിലോ നിങ്ങൾ ഏകദേശം എത്ര കേസുകൾ കൈകാര്യം ചെയ്യും?',
    qCheckerMissing: 'ഇത് അന്തിമമായി കണക്കാക്കുന്നതിന് മുമ്പ് ആരെങ്കിലും ഇത് പരിശോധിക്കുകയോ അംഗീകരിക്കുകയോ ചെയ്യാറുണ്ടോ?',
    qCheckerWhat: 'മനസ്സിലായി. ഇത് ശരിയായി രേഖപ്പെടുത്താൻ, മാനേജർ (അല്ലെങ്കിൽ അംഗീകാരം നൽകുന്നയാൾ) അംഗീകരിക്കുന്നതിന് മുമ്പ് സാധാരണയായി എന്താണ് പരിശോധിക്കുന്നത്?',
    qRejection: 'ഇത് നിരസിക്കപ്പെടുകയോ തിരിച്ചയക്കുകയോ ചെയ്താൽ എന്ത് സംഭവിക്കും — അപ്പോൾ നിങ്ങൾ എന്ത് ചെയ്യും?',
    qSubmitWhere: 'ഇത് എവിടെയാണ് സമർപ്പിക്കുന്നത് — ഗവൺമെന്റ് പോർട്ടൽ, ഇമെയിൽ, Odoo, അല്ലെങ്കിൽ മറ്റൊരു സിസ്റ്റം?',
    qDuplicateAsk: 'ജീവനക്കാർ ഒരേ ക്ലയന്റ് വിവരങ്ങൾ ഒന്നിലധികം സിസ്റ്റങ്ങളിൽ നൽകുകയോ പകർത്തുകയോ ചെയ്യാറുണ്ടോ?',
    qDuplicateWhich: 'സാധാരണയായി ഇവയ്ക്കിടയിൽ ഏത് വിവരമാണ് ആവർത്തിക്കുന്നത്?',
    qMissingDocWhat: 'ആവശ്യമായ ഒരു രേഖ ഇല്ലാതിരിക്കുമ്പോൾ എന്ത് സംഭവിക്കും?',
    qMissingDocWho: 'ഇതിനെക്കുറിച്ച് ക്ലയന്റുമായി ആരാണ് ഫോളോ-അപ്പ് ചെയ്യുന്നത്?',
    qMissingDocHow: 'ഇന്ന് അവർ എങ്ങനെയാണ് ഫോളോ-അപ്പ് ചെയ്യുന്നത് — WhatsApp, ഇമെയിൽ, ഫോൺ, സിസ്റ്റം ആക്ടിവിറ്റി, അതോ മറ്റൊരു രീതി?',
    qAuthorityManual: 'ആരെങ്കിലും പോർട്ടൽ അപ്ഡേറ്റുകൾക്കായി സ്വമേധയാ പരിശോധിക്കാറുണ്ടോ?',
    qUrgentDiff: 'അടിയന്തിര അല്ലെങ്കിൽ മുൻഗണനാ കേസുകൾ കൈകാര്യം ചെയ്യുന്നതിൽ എന്താണ് വ്യത്യാസം?',
    qWaitWhere: 'ഈ പ്രോസസിന്റെ ഏത് ഭാഗമാണ് സാധാരണയായി കാത്തിരിക്കാൻ ഏറ്റവും കൂടുതൽ സമയമെടുക്കുന്നത്, ഏകദേശം എത്ര സമയമെടുക്കും?',
    qWaitingGeneral: 'തുടരുന്നതിന് മുമ്പ് ആരെയെങ്കിലും അല്ലെങ്കിൽ എന്തിനെയെങ്കിലും കാത്തിരിക്കേണ്ട എന്തെങ്കിലും ഘട്ടങ്ങൾ ഈ പ്രോസസിൽ ഉണ്ടോ?',
    qOtherDeptDetail: 'ഏത് മറ്റ് ഡിപ്പാർട്ട്മെന്റാണ് ഉൾപ്പെട്ടിരിക്കുന്നത്, അവരിൽ നിന്ന് നിങ്ങൾക്ക് എന്താണ് വേണ്ടത്?',
    qExceptions:
      'അടിയന്തിര അഭ്യർത്ഥനകൾ, VIP ക്ലയന്റുകൾ, പുതുക്കലുകൾ, അല്ലെങ്കിൽ വ്യത്യസ്ത ഉപഭോക്തൃ/രാജ്യ ആവശ്യകതകൾ പോലുള്ള, സാധാരണ കേസിൽ നിന്ന് വ്യത്യസ്തമായി കൈകാര്യം ചെയ്യുന്ന പ്രത്യേക കേസുകൾ ഉണ്ടോ?',
    qKnowledge1:
      'ഈ പ്രോസസ് കൈകാര്യം ചെയ്യുന്നതിനെക്കുറിച്ച് പരിചയസമ്പന്നരായ ജീവനക്കാർക്ക് അറിയാവുന്നതും എവിടെയും രേഖപ്പെടുത്താത്തതുമായ എന്തെങ്കിലും ഉണ്ടോ — പ്രത്യേക പരിശോധനകൾ, പൊതുവായ തെറ്റുകൾ, അല്ലെങ്കിൽ ഒരു പുതിയ ജീവനക്കാരന് അറിയാത്ത കാര്യങ്ങൾ?',
    qKnowledge2: 'ഈ പ്രോസസിനായി നിങ്ങൾ ഏതെങ്കിലും സ്റ്റാൻഡേർഡ് ടെംപ്ലേറ്റുകളോ ചെക്ക്‌ലിസ്റ്റുകളോ ഇമെയിൽ ഫോർമാറ്റുകളോ ഉപയോഗിക്കാറുണ്ടോ?',
    qCorrectionWhat: 'സാരമില്ല — നമ്മൾ എന്താണ് തിരുത്തേണ്ടത് അല്ലെങ്കിൽ ചേർക്കേണ്ടത്?',
    obsDuplicateEntry: 'ഒരേ ക്ലയന്റ് വിവരങ്ങൾ ഒന്നിലധികം സിസ്റ്റങ്ങളിൽ നൽകുകയോ പകർത്തുകയോ ചെയ്യുന്നതായി ഞാൻ ശ്രദ്ധിച്ചു.\n\nഇത് ശരിയാണോ?',
    obsDocDependency:
      'ഈ പ്രോസസ് ക്ലയന്റിൽ നിന്ന് രേഖകൾ ലഭിക്കുന്നതിനെ വളരെയധികം ആശ്രയിക്കുന്നതായി തോന്നുന്നു, ഇത് കാലതാമസത്തിന്റെ ഒരു ഉറവിടമായിരിക്കാം.\n\nക്ലയന്റ് ഡോക്യുമെന്റ് ശേഖരണം കാലതാമസത്തിന്റെ പ്രധാന കാരണങ്ങളിലൊന്നാണെന്ന് നിങ്ങൾ പറയുമോ?',
    obsKnowledgeRisk:
      'പരിചയസമ്പന്നരായ ജീവനക്കാർക്ക് ചില സാഹചര്യങ്ങൾ കൈകാര്യം ചെയ്യാൻ അറിയാമെന്ന് നിങ്ങൾ പറഞ്ഞു, പക്ഷേ ഇത് എവിടെയും രേഖപ്പെടുത്തിയിട്ടില്ല.\n\nഇത് ഔപചാരികമായി രേഖപ്പെടുത്തേണ്ട പ്രധാനപ്പെട്ട പ്രോസസ് അറിവായിരിക്കാം. ഇത് ശരിയാണോ?',
    obsManualFollowUp: 'ഇല്ലാത്ത വിവരങ്ങളോ സ്റ്റാറ്റസ് അപ്ഡേറ്റുകളോ ഫോളോ-അപ്പ് ചെയ്യുന്നത് ഇന്ന് സ്വമേധയാ ആണെന്ന് തോന്നുന്നു.\n\nഇത് ന്യായമായ വിവരണമാണോ?',
    obsAuthorityCheck:
      'ഗവൺമെന്റ് പോർട്ടലോ ബാഹ്യ സിസ്റ്റമോ അപ്ഡേറ്റുകൾക്കായി ആരെങ്കിലും സ്വമേധയാ പരിശോധിക്കുന്നതായി തോന്നുന്നു, സ്വയമേവ അറിയിപ്പ് ലഭിക്കുന്നതിന് പകരം.\n\nഇത് ശരിയാണോ?',
    obsBottleneckGeneral:
      'നിങ്ങൾ വിവരിച്ചതിന്റെ അടിസ്ഥാനത്തിൽ, കാത്തിരിപ്പും ഫോളോ-അപ്പും ഈ പ്രോസസിന് ഗണ്യമായ സമയം ചേർക്കുന്നുണ്ടാകാം.\n\nഇത് കാലതാമസത്തിന്റെ വലിയ ഉറവിടങ്ങളിലൊന്നാണെന്ന് നിങ്ങൾ സമ്മതിക്കുമോ?',
    tagObservation: 'AI നിരീക്ഷണം',
    tagBottleneck: 'സാധ്യമായ തടസ്സം',
    tagKnowledge: 'അറിവ് അപകടസാധ്യത',
    tagSummary: 'പ്രോസസ് സംഗ്രഹം',
    btnYes: 'അതെ',
    btnPartly: 'ഭാഗികമായി',
    btnNo: 'ഇല്ല',
    btnConfirm: 'സ്ഥിരീകരിക്കുക',
    btnCorrection: 'തിരുത്തൽ ആവശ്യമുണ്ട്',
    summaryIntro: 'അന്തിമ പ്രോസസ് റിപ്പോർട്ട് തയ്യാറാക്കുന്നതിന് മുമ്പ്, ഞാൻ ഇതുവരെ മനസ്സിലാക്കിയത് ഇതാ:',
    summaryAskCorrect: 'ഇത് പൊതുവെ ശരിയാണോ?',
    thanksConfirmed: 'നന്ദി — സ്ഥിരീകരിച്ചു.',
    completionMsg: 'നിങ്ങളുടെ ഇന്റർവ്യൂ പൂർത്തിയായി. പകർത്തിയ പ്രോസസ് വിശദാംശങ്ങൾ, ഘട്ടങ്ങൾ, സ്ഥിരീകരിച്ച നിരീക്ഷണങ്ങൾ എന്നിവ താഴെ സേവ് ചെയ്തിരിക്കുന്നു.',
    label_process: 'പ്രോസസ്',
    label_department: 'ഡിപ്പാർട്ട്മെന്റ്',
    label_start: 'തുടക്കം',
    label_mainflow: 'പ്രധാന ഫ്ലോ',
    label_delay: 'പ്രധാന കാലതാമസം',
    label_systems: 'പ്രധാന സിസ്റ്റങ്ങൾ',
    label_controls: 'പ്രധാന നിയന്ത്രണങ്ങൾ',
    needCorrectionPrompt: 'ശരി — നമുക്ക് ഇത് മെച്ചപ്പെടുത്താം. നിങ്ങൾക്ക് എന്താണ് തിരുത്തേണ്ടത് അല്ലെങ്കിൽ ചേർക്കേണ്ടത്?',
    inputPlaceholder: 'നിങ്ങളുടെ ഉത്തരം ടൈപ്പ് ചെയ്യുക...',
    langName: 'മലയാളം'
  }
};

export function t(language: Language, key: string): string {
  return I18N[language][key] ?? I18N.en[key] ?? key;
}

export function languageOptions(): { code: Language; name: string }[] {
  return (Object.keys(I18N) as Language[]).map((code) => ({ code, name: I18N[code].langName }));
}

/* ============================================================
   Keyword detection — ported verbatim from KW / detect() / extractSystems().
   ============================================================ */
const KW = {
  odoo: /odoo/i,
  excel: /excel|spreadsheet|sheet/i,
  portal: /portal|government site|gov\.|ejari|dubai\s*trade|immigration system/i,
  whatsapp: /whatsapp/i,
  email: /email|e-mail/i,
  crm: /\bcrm\b/i,
  sharepoint: /sharepoint|drive|google drive/i,
  approve: /approv|sign[- ]?off|authoriz|अनुमोद|موافق|批准|അംഗീകാര/i,
  check: /\bcheck|review|verify|validat|जांच|فحص|检查|പരിശോധ/i,
  submit: /submit|upload|file it|send it|सबमिट|تقديم|提交|സമർപ്പ/i,
  document: /document|docs?\b|paperwork|attachment|दस्तावेज़|مستند|文件|രേഖ/i,
  missing: /missing|incomplete|not received|pending doc|गुम|ناقص|缺失|ഇല്ലാത്ത/i,
  manager: /manager|supervisor|team lead|head of|director|मैनेजर|مدير|经理|മാനേജ/i,
  authority: /authority|government|ministry|immigration|department of|प्राधिकरण|جهة حكومية|政府|അതോറിറ്റി/i,
  urgent: /urgent|rush|priority|vip|emergency|अत्यावश्यक|عاجل|紧急|അടിയന്തിര/i,
  wait: /wait|delay|takes time|queue|pending|प्रतीक्षा|انتظار|等待|കാത്തിരി/i,
  followup: /follow[- ]?up|chase|remind|फॉलो|متابعة|跟进|ഫോളോ/i,
  rework: /rework|redo|resubmit|resend|correct again|फिर से/i,
  reject: /reject|declin|return.*case|send back|bounce|अस्वीकृत|رفض|拒绝|നിരസ്/i,
  client: /client|customer|ग्राहक|عميل|客户|ക്ലയന്റ്/i,
  otherDept: /other department|another team|finance team|accounts team|hr team|legal team|दूसरे विभाग|قسم آخر|其他部门/i,
  vendor: /vendor|supplier|विक्रेता|مورّد|供应商/i,
  external: /consultant|lawyer|auditor|external firm|third[- ]?party/i,
  doneSignals:
    /that'?s (it|all)|nothing else|case (is )?closed|process (is )?complete|finished|done( with)? (it|that)|समाप्त|मुझे नहीं लगता|انتهت|هذا كل شيء|完成了|没有了|അവസാനിച്ചു|ഇല്ല/i,
  duplicateHint: /(same|duplicate).*(information|data|details)|copy.*(into|to)|enter.*(twice|again|both)/i
} as const;

export type Flags = Record<keyof typeof KW, boolean>;

export function detect(text: string): Flags {
  const out = {} as Flags;
  (Object.keys(KW) as (keyof typeof KW)[]).forEach((k) => {
    out[k] = KW[k].test(text);
  });
  return out;
}

export function extractSystems(text: string): string[] {
  const found: string[] = [];
  if (KW.odoo.test(text)) found.push('Odoo');
  if (KW.excel.test(text)) found.push('Excel');
  if (KW.portal.test(text)) found.push('Government Portal');
  if (KW.whatsapp.test(text)) found.push('WhatsApp');
  if (KW.email.test(text)) found.push('Email');
  if (KW.crm.test(text)) found.push('CRM');
  if (KW.sharepoint.test(text)) found.push('SharePoint/Drive');
  return found;
}

/* ============================================================
   State factory
   ============================================================ */
const DIM_KEYS: DimKey[] = [
  'start',
  'workflow',
  'roles',
  'systems',
  'controls',
  'waiting',
  'exceptions',
  'knowledge',
  'aiOpp',
  'kpis'
];

export function newInterviewState(language: Language): InterviewState {
  return {
    language,
    stage: 'department',
    lastQKey: null,
    walkStepCount: 0,
    duplicateAsked: false,
    pendingClar: [],
    pendingObs: [],

    department: null,
    role: null,
    mainActivities: null,
    name: null,
    trigger: null,
    outcome: null,
    frequency: null,

    steps: [],
    systemsMentioned: {},

    checker: null,
    checkerDetail: null,
    rejectionHandling: null,
    waitDetail: null,

    deps: { client: false, otherDept: false, otherDeptDetail: null, manager: false, authority: false, vendor: false, external: false },
    problems: {
      manualWork: false,
      repeatedEntry: false,
      waiting: false,
      followUp: false,
      missingDocs: false,
      errors: false,
      rework: false,
      delays: false,
      unclearResp: false,
      noChecklist: true
    },

    exceptions: [],
    knowledge: [],
    templates: [],
    confirmedFacts: [],
    aiObservations: [],
    needsConfirmation: [],
    obsGiven: {},

    dims: { start: 0, workflow: 0, roles: 0, systems: 0, controls: 0, waiting: 0, exceptions: 0, knowledge: 0, aiOpp: 0, kpis: 0 },
    completeness: 0,

    transcript: [],
    completed: false
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function bumpDim(state: InterviewState, key: DimKey, amount: number): void {
  state.dims[key] = clamp((state.dims[key] || 0) + amount, 0, 100);
}

function computeCompleteness(state: InterviewState): number {
  const sum = DIM_KEYS.reduce((acc, k) => acc + state.dims[k], 0);
  state.completeness = Math.round(sum / DIM_KEYS.length);
  return state.completeness;
}

/* ============================================================
   Begin interview
   ============================================================ */
export function beginInterview(language: Language): { state: InterviewState; messages: EngineAction[] } {
  const state = newInterviewState(language);
  const intro: EngineAction = { kind: 'ai_message', text: t(language, 'intro'), questionKey: '__intro__' };
  const firstQuestion = askQ(state, 'qDepartment', 'department');
  return { state, messages: [intro, firstQuestion] };
}

function askQ(state: InterviewState, qKey: string, stageAfter?: string): EngineAction {
  state.lastQKey = qKey;
  if (stageAfter) state.stage = stageAfter;
  return { kind: 'ai_message', text: t(state.language, qKey), questionKey: qKey };
}

/* ============================================================
   Core analysis per answer — ported verbatim from processAnswer().
   ============================================================ */
const NEGATIVE_RE = /\bno\b|not really|nobody|none|कोई नहीं|لا أحد|没有|ഇല്ല|لا يوجد|ഒന്നുമില്ല/i;
const AFFIRMATIVE_RE = /yes|often|sometimes|manually|हां|نعم|是|അതെ/i;

function processAnswer(state: InterviewState, qKey: string | null, text: string, flags: Flags): void {
  const sys = extractSystems(text);
  sys.forEach((s) => {
    state.systemsMentioned[s] = true;
  });

  switch (qKey) {
    case 'qDepartment':
      state.department = text;
      bumpDim(state, 'start', 25);
      break;
    case 'qRole':
      state.role = text;
      bumpDim(state, 'start', 25);
      break;
    case 'qActivities':
      state.mainActivities = text;
      bumpDim(state, 'start', 20);
      break;
    case 'qProcessName':
      state.name = text.length > 60 ? text.slice(0, 60) : text;
      bumpDim(state, 'start', 30);
      state.confirmedFacts.push('Process name: ' + state.name);
      break;
    case 'qTrigger':
      state.trigger = text;
      bumpDim(state, 'workflow', 10);
      break;
    case 'qOutcome':
      state.outcome = text;
      bumpDim(state, 'workflow', 10);
      break;
    case 'qFrequency':
      state.frequency = text;
      bumpDim(state, 'kpis', 15);
      break;
    case 'qCheckerMissing':
      if (NEGATIVE_RE.test(text) && !flags.approve) {
        state.problems.unclearResp = true;
      } else {
        state.checker = text;
      }
      bumpDim(state, 'controls', 30);
      break;
    case 'qCheckerWhat':
      state.checkerDetail = text;
      bumpDim(state, 'controls', 30);
      state.confirmedFacts.push('Checker/approver reviews: ' + text);
      break;
    case 'qRejection':
      state.rejectionHandling = text;
      state.problems.rework = true;
      bumpDim(state, 'controls', 20);
      break;
    case 'qSubmitWhere':
      extractSystems(text).forEach((s) => {
        state.systemsMentioned[s] = true;
      });
      bumpDim(state, 'systems', 20);
      break;
    case 'qDuplicateWhich':
      state.confirmedFacts.push('Duplicated information between systems: ' + text);
      state.problems.repeatedEntry = true;
      bumpDim(state, 'systems', 20);
      break;
    case 'qMissingDocWhat':
      state.confirmedFacts.push('When documents are missing: ' + text);
      state.problems.missingDocs = true;
      bumpDim(state, 'waiting', 15);
      break;
    case 'qMissingDocWho':
      state.confirmedFacts.push('Missing-document follow-up owner: ' + text);
      bumpDim(state, 'roles', 15);
      break;
    case 'qMissingDocHow':
      state.confirmedFacts.push('Follow-up method: ' + text);
      state.problems.followUp = true;
      bumpDim(state, 'waiting', 15);
      break;
    case 'qAuthorityManual':
      if (AFFIRMATIVE_RE.test(text)) {
        state.problems.manualWork = true;
      }
      bumpDim(state, 'waiting', 10);
      break;
    case 'qUrgentDiff':
      state.exceptions.push('Urgent/priority cases: ' + text);
      bumpDim(state, 'exceptions', 35);
      break;
    case 'qWaitWhere':
      state.waitDetail = text;
      state.problems.delays = true;
      state.problems.waiting = true;
      bumpDim(state, 'waiting', 30);
      break;
    case 'qWaitingGeneral':
      if (NEGATIVE_RE.test(text)) {
        bumpDim(state, 'waiting', 35);
      } else {
        state.problems.waiting = true;
        state.deps.authority = state.deps.authority || flags.authority;
      }
      break;
    case 'qOtherDeptDetail':
      state.deps.otherDeptDetail = text;
      bumpDim(state, 'roles', 15);
      break;
    case 'qExceptions':
      if (!NEGATIVE_RE.test(text)) state.exceptions.push(text);
      bumpDim(state, 'exceptions', 65);
      break;
    case 'qKnowledge1':
      if (!NEGATIVE_RE.test(text)) {
        state.knowledge.push(text);
      }
      bumpDim(state, 'knowledge', 55);
      break;
    case 'qKnowledge2':
      if (!NEGATIVE_RE.test(text)) state.templates.push(text);
      bumpDim(state, 'knowledge', 45);
      break;
    case 'qCorrectionWhat':
      state.confirmedFacts.push('Correction/addition: ' + text);
      break;
    default:
      // walkthrough steps are handled below via handleWalkthroughStep
      break;
  }

  if (qKey === 'qFirstStep' || qKey === 'qNext' || qKey === 'qAfterThat' || qKey === 'qContinue' || qKey === 'qIsThatAll') {
    handleWalkthroughStep(state, text, flags);
  }

  if (flags.client) state.deps.client = true;
  if (flags.otherDept) state.deps.otherDept = true;
  if (flags.manager) state.deps.manager = true;
  if (flags.authority) state.deps.authority = true;
  if (flags.vendor) state.deps.vendor = true;
  if (flags.external) state.deps.external = true;
  if (flags.missing) state.problems.missingDocs = true;
  if (flags.followup) state.problems.followUp = true;
  if (flags.rework) state.problems.rework = true;
  if (flags.wait) state.problems.waiting = true;

  computeCompleteness(state);
}

function handleWalkthroughStep(state: InterviewState, text: string, flags: Flags): void {
  const sys = extractSystems(text);
  const owner = flags.manager ? 'Manager' : flags.otherDept ? 'Other department' : state.role || 'Employee';
  state.steps.push({ text, owner, systems: sys });
  state.walkStepCount++;
  bumpDim(state, 'workflow', Math.min(70, state.walkStepCount * 14));
  if (sys.length) bumpDim(state, 'systems', 20);
  if (flags.manager || flags.check) bumpDim(state, 'roles', 15);

  if (flags.approve && !state.checkerDetail && !state.pendingClar.includes('qCheckerWhat')) {
    state.pendingClar.push('qCheckerWhat');
  } else if (flags.submit && sys.length === 0 && !state.pendingClar.includes('qSubmitWhere')) {
    state.pendingClar.push('qSubmitWhere');
  } else if (
    flags.missing &&
    !state.pendingClar.includes('qMissingDocWhat') &&
    !state.confirmedFacts.some((f) => f.startsWith('When documents are missing:'))
  ) {
    state.pendingClar.push('qMissingDocWhat');
    state.pendingClar.push('qMissingDocWho');
    state.pendingClar.push('qMissingDocHow');
  } else if (flags.authority && !state.pendingClar.includes('qAuthorityManual')) {
    state.pendingClar.push('qAuthorityManual');
  } else if (flags.urgent && !state.pendingClar.includes('qUrgentDiff')) {
    state.pendingClar.push('qUrgentDiff');
  } else if (flags.wait && !state.pendingClar.includes('qWaitWhere')) {
    state.pendingClar.push('qWaitWhere');
  } else if (flags.otherDept && !state.pendingClar.includes('qOtherDeptDetail')) {
    state.pendingClar.push('qOtherDeptDetail');
  }

  const sysCount = Object.keys(state.systemsMentioned).length;
  if (sysCount >= 2 && !state.duplicateAsked) {
    state.pendingClar.push('qDuplicateAsk');
    state.duplicateAsked = true;
  }
}

/* ============================================================
   AI opportunity / observation derivation — ported verbatim from deriveAiOpportunities().
   ============================================================ */
function deriveAiOpportunities(state: InterviewState): void {
  const sysCount = Object.keys(state.systemsMentioned).length;
  if (sysCount >= 2 && !state.obsGiven.duplicate) {
    state.obsGiven.duplicate = true;
    state.pendingObs.push({ key: 'duplicateEntry', category: 'OBSERVATION', text: t(state.language, 'obsDuplicateEntry') });
  }
  if ((state.problems.missingDocs || state.deps.client) && !state.obsGiven.doc) {
    state.obsGiven.doc = true;
    state.pendingObs.push({ key: 'docDependency', category: 'BOTTLENECK', text: t(state.language, 'obsDocDependency') });
  }
  if (state.knowledge.length > 0 && !state.obsGiven.knowledge) {
    state.obsGiven.knowledge = true;
    state.pendingObs.push({ key: 'knowledgeRisk', category: 'KNOWLEDGE_RISK', text: t(state.language, 'obsKnowledgeRisk') });
  }
  if (state.problems.followUp && !state.obsGiven.followup) {
    state.obsGiven.followup = true;
    state.pendingObs.push({ key: 'manualFollowUp', category: 'OBSERVATION', text: t(state.language, 'obsManualFollowUp') });
  }
  if (state.deps.authority && !state.obsGiven.authority) {
    state.obsGiven.authority = true;
    state.pendingObs.push({ key: 'authorityCheck', category: 'OBSERVATION', text: t(state.language, 'obsAuthorityCheck') });
  }
  if (state.problems.waiting && !state.obsGiven.bottleneck) {
    state.obsGiven.bottleneck = true;
    state.pendingObs.push({ key: 'bottleneckGeneral', category: 'BOTTLENECK', text: t(state.language, 'obsBottleneckGeneral') });
  }
}

function nextObservationAction(state: InterviewState): EngineAction {
  const obs = state.pendingObs.shift();
  if (!obs) return decideNext(state);
  return { kind: 'observation', observationKey: obs.key, category: obs.category, text: obs.text };
}

/* ============================================================
   Final summary
   ============================================================ */
function buildSummaryText(state: InterviewState): string {
  const sys = Object.keys(state.systemsMentioned);
  const flow = state.steps.map((s) => (s.text.length > 50 ? s.text.slice(0, 50) + '…' : s.text));
  let txt = '';
  txt += t(state.language, 'label_process') + ': ' + (state.name || '—') + '\n';
  txt += t(state.language, 'label_department') + ': ' + (state.department || '—') + '\n';
  txt += t(state.language, 'label_start') + ': ' + (state.trigger || '—') + '\n\n';
  txt += t(state.language, 'label_mainflow') + ':\n' + flow.join('\n→ ') + '\n\n';
  const delay = state.waitDetail || (state.problems.missingDocs ? 'Missing client documents' : '—');
  txt += t(state.language, 'label_delay') + ': ' + delay + '\n';
  txt += t(state.language, 'label_systems') + ': ' + (sys.length ? sys.join(', ') : '—') + '\n';
  txt += t(state.language, 'label_controls') + ': ' + (state.checkerDetail || state.checker || '—');
  return txt;
}

function buildSummaryAction(state: InterviewState): EngineAction {
  return {
    kind: 'summary',
    introText: t(state.language, 'summaryIntro'),
    summaryText: buildSummaryText(state) + '\n\n' + t(state.language, 'summaryAskCorrect')
  };
}

/* ============================================================
   decideNext — the adaptive core. Ported verbatim from decideNext(), including the
   correctionAsk override that wrapped the original function in the prototype.
   ============================================================ */
function decideNext(state: InterviewState): EngineAction {
  if (state.stage === 'correctionAsk') {
    state.stage = 'summary';
    return buildSummaryAction(state);
  }

  if (state.pendingClar.length) {
    const qk = state.pendingClar.shift() as string;
    return askQ(state, qk, state.stage);
  }

  if (state.lastQKey === 'qDuplicateAsk') {
    const lastAns = state.transcript[state.transcript.length - 1]?.a || '';
    if (AFFIRMATIVE_RE.test(lastAns)) {
      return askQ(state, 'qDuplicateWhich', state.stage);
    }
  }

  switch (state.stage) {
    case 'department':
      return askQ(state, 'qRole', 'role');
    case 'role':
      return askQ(state, 'qActivities', 'activities');
    case 'activities':
      return askQ(state, 'qProcessName', 'processName');
    case 'processName':
      return askQ(state, 'qTrigger', 'trigger');
    case 'trigger':
      state.stage = 'walkthrough';
      return askQ(state, 'qFirstStep', 'walkthrough');
    case 'walkthrough': {
      const lastAns = state.transcript[state.transcript.length - 1]?.a || '';
      const doneSignal = KW.doneSignals.test(lastAns);
      if (doneSignal || state.walkStepCount >= 7) {
        return askQ(state, 'qOutcome', 'outcome');
      }
      if (state.walkStepCount === 1) return askQ(state, 'qNext', 'walkthrough');
      if (state.walkStepCount === 2) return askQ(state, 'qAfterThat', 'walkthrough');
      if (state.walkStepCount === 5) return askQ(state, 'qIsThatAll', 'walkthrough');
      return askQ(state, 'qContinue', 'walkthrough');
    }
    case 'outcome':
      return askQ(state, 'qFrequency', 'frequency');
    case 'frequency':
      state.stage = 'systemsReview';
      if (!state.checker && !state.checkerDetail) {
        return askQ(state, 'qCheckerMissing', 'checker');
      }
      state.stage = 'checker';
      return decideNext(state);
    case 'systemsReview':
      if (!state.checker && !state.checkerDetail) return askQ(state, 'qCheckerMissing', 'checker');
      state.stage = 'checker';
      return decideNext(state);
    case 'checker':
      if (state.checker && !state.checkerDetail && !state.pendingClar.includes('qCheckerWhat')) {
        return askQ(state, 'qCheckerWhat', 'checker');
      }
      if ((state.checker || state.checkerDetail) && !state.rejectionHandling) {
        return askQ(state, 'qRejection', 'rejection');
      }
      state.stage = 'waiting';
      return decideNext(state);
    case 'rejection':
      state.stage = 'waiting';
      return decideNext(state);
    case 'waiting':
      if (!state.waitDetail && !state.problems.waiting && state.dims.waiting < 50) {
        return askQ(state, 'qWaitingGeneral', 'waiting2');
      }
      state.stage = 'exceptions';
      return decideNext(state);
    case 'waiting2':
      if (state.problems.waiting && !state.waitDetail) return askQ(state, 'qWaitWhere', 'waiting');
      state.stage = 'exceptions';
      return decideNext(state);
    case 'exceptions':
      if (state.exceptions.length === 0 && state.dims.exceptions < 60) {
        return askQ(state, 'qExceptions', 'exceptions2');
      }
      state.stage = 'knowledge';
      return decideNext(state);
    case 'exceptions2':
      state.stage = 'knowledge';
      return decideNext(state);
    case 'knowledge':
      if (state.dims.knowledge < 40) {
        return askQ(state, 'qKnowledge1', 'knowledge2');
      }
      state.stage = 'aiOppReview';
      return decideNext(state);
    case 'knowledge2':
      if (state.dims.knowledge < 90) return askQ(state, 'qKnowledge2', 'aiOppReview');
      state.stage = 'aiOppReview';
      return decideNext(state);
    case 'aiOppReview':
      deriveAiOpportunities(state);
      if (state.pendingObs.length) {
        state.stage = 'observations';
        return nextObservationAction(state);
      }
      bumpDim(state, 'aiOpp', 100);
      state.stage = 'summary';
      return buildSummaryAction(state);
    case 'observations':
      if (state.pendingObs.length) return nextObservationAction(state);
      bumpDim(state, 'aiOpp', 100);
      state.stage = 'summary';
      return buildSummaryAction(state);
    case 'correction':
      state.stage = 'summary';
      return buildSummaryAction(state);
    default:
      // Should not happen — fall back to the summary rather than throwing.
      return buildSummaryAction(state);
  }
}

/* ============================================================
   Public entry points
   ============================================================ */

/** Submit the employee's answer to the current question and get the next engine action. */
export function submitAnswer(state: InterviewState, rawText: string): EngineAction {
  const text = rawText.trim();
  if (!text) {
    // Re-ask the same question rather than silently advancing on an empty answer.
    return { kind: 'ai_message', text: t(state.language, state.lastQKey || 'qDepartment'), questionKey: state.lastQKey || 'qDepartment' };
  }
  state.transcript.push({ q: state.lastQKey, a: text });
  const flags = detect(text);
  processAnswer(state, state.lastQKey, text, flags);
  return decideNext(state);
}

/** Resolve a pending AI Observation card (Yes / Partly / No) and get the next engine action. */
export function resolveObservation(
  state: InterviewState,
  observationKey: string,
  status: 'confirmed' | 'partly' | 'rejected'
): EngineAction {
  const text = t(state.language, observationTextKey(observationKey));
  state.aiObservations.push({ text, status, key: observationKey });
  if (status === 'confirmed' || status === 'partly') {
    state.confirmedFacts.push('AI Observation confirmed (' + status + '): ' + observationKey);
    if (observationKey === 'duplicateEntry') state.problems.repeatedEntry = true;
    if (observationKey === 'docDependency') state.problems.missingDocs = true;
    if (observationKey === 'manualFollowUp') state.problems.followUp = true;
    if (observationKey === 'authorityCheck') state.problems.manualWork = true;
    if (observationKey === 'bottleneckGeneral') state.problems.delays = true;
  } else {
    state.needsConfirmation.push(observationKey + ' (marked not applicable by employee)');
  }
  return decideNext(state);
}

function observationTextKey(observationKey: string): string {
  const map: Record<string, string> = {
    duplicateEntry: 'obsDuplicateEntry',
    docDependency: 'obsDocDependency',
    knowledgeRisk: 'obsKnowledgeRisk',
    manualFollowUp: 'obsManualFollowUp',
    authorityCheck: 'obsAuthorityCheck',
    bottleneckGeneral: 'obsBottleneckGeneral'
  };
  return map[observationKey] || observationKey;
}

/** The employee confirms the final summary is correct — completes the interview. */
export function confirmSummary(state: InterviewState): EngineAction {
  bumpDim(state, 'kpis', 100);
  state.completed = true;
  return { kind: 'completed', text: t(state.language, 'thanksConfirmed') + ' ' + t(state.language, 'completionMsg') };
}

/** The employee says the summary needs a correction — reopens one free-text turn. */
export function needCorrection(state: InterviewState): EngineAction {
  state.stage = 'correctionAsk';
  return askQ(state, 'qCorrectionWhat');
}

export function getButtonLabels(language: Language) {
  return {
    yes: t(language, 'btnYes'),
    partly: t(language, 'btnPartly'),
    no: t(language, 'btnNo'),
    confirm: t(language, 'btnConfirm'),
    correction: t(language, 'btnCorrection')
  };
}

export function observationTagLabel(language: Language, category: ObservationCategory): string {
  if (category === 'BOTTLENECK') return t(language, 'tagBottleneck');
  if (category === 'KNOWLEDGE_RISK') return t(language, 'tagKnowledge');
  return t(language, 'tagObservation');
}
