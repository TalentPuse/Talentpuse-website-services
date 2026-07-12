/**
 * Landing-page copy — the single i18n dictionary for `/` (Vietnamese-primary,
 * English mirror). `en` is typed as `typeof vi`, so a missing key is a compile
 * error — VI/EN parity is enforced by the type checker.
 *
 * Tech nouns (React, AI, dashboard, Telegram, …) stay English in both languages
 * by design — that is how this audience reads job posts. All display NUMBERS come
 * from `lib/landing-data.ts`, not from here.
 */

export type Lang = "vi" | "en";

const vi = {
  nav: {
    features: "Tính năng",
    data: "Dữ liệu",
    pipeline: "AI Agent",
    students: "Sinh viên",
    faq: "FAQ",
    signIn: "Đăng nhập",
    signUp: "Dùng thử miễn phí",
  },
  hero: {
    badge: "Tìm việc · Quản lý ứng tuyển · AI đồng hành",
    lead: "Từ tìm việc đến nhận offer, ",
    highlight: "để AI đi cùng bạn",
    tail: ".",
    sub: "TalentPuse giúp bạn tìm job IT phù hợp, quản lý mọi đơn ứng tuyển ở một nơi, và được AI nhắc follow-up, tư vấn suốt hành trình — để không cơ hội việc làm nào bị bỏ lỡ.",
    ctaPrimary: "Bắt đầu miễn phí",
    ctaSecondary: "Xem AI làm việc",
  },
  heroDemo: {
    title: "Ứng tuyển của bạn",
    aiLabel: "AI theo dõi",
    insight: "Bạn có {total} job đang theo dõi. {followups} cần follow-up, {interviews} lịch phỏng vấn tuần này.",
    caption: "Demo minh họa",
    statuses: {
      applied: "Đã ứng tuyển",
      interviewing: "Phỏng vấn",
      offer: "Offer",
    },
    followUp: "Cần follow-up",
  },
  statsStrip: {
    jobsAnalyzed: "tin tuyển dụng đã phân tích",
    companies: "công ty đang tuyển",
    skillsTracked: "kỹ năng được theo dõi",
    refresh: "chu kỳ cập nhật dữ liệu",
    sourcesPrefix: "Tổng hợp từ",
    ticker: { jobsUnit: "jobs", salaryUnit: "tr/tháng", trend: "YoY" },
  },
  dataStory: {
    badge: "Dữ liệu thị trường",
    heading: "Dữ liệu nói gì về thị trường?",
    sub: "Không phải cảm tính — đây là bức tranh tổng hợp từ hàng nghìn tin tuyển dụng IT tại Việt Nam.",
    chartTitle: "Kỹ năng được tuyển nhiều nhất",
    chartUnit: "tin",
    salaryExplorer: {
      title: "Bạn sẽ kiếm được bao nhiêu?",
      levelLabel: "Cấp bậc",
      cityLabel: "Thành phố",
      medianLabel: "Trung vị",
      rangeLabel: "Khoảng phổ biến",
      unit: "triệu/tháng",
      levels: {
        intern: "Thực tập",
        fresher: "Fresher",
        junior: "Junior",
        middle: "Middle",
        senior: "Senior",
      },
      cities: { hcm: "TP.HCM", hanoi: "Hà Nội", danang: "Đà Nẵng" },
    },
    topPaying: {
      title: "Kỹ năng trả lương cao nhất",
      colSkill: "Kỹ năng",
      colSalary: "Lương TB",
      colJobs: "Số tin",
      unit: "tr",
    },
  },
  alertShowcase: {
    badge: "Tính năng nổi bật",
    heading: "Job phù hợp tự tìm đến bạn",
    sub: "Đừng lướt VietnamWorks, ITviec, LinkedIn mỗi ngày nữa. TalentPuse gom job từ cả 3 nền tảng về một chỗ, để AI lọc và chỉ báo khi có tin thật sự khớp với bạn.",
    bullet1: "Gom job đa nguồn — VietnamWorks, ITviec, LinkedIn — về chung một luồng, bạn không phải mở từng trang mỗi ngày.",
    bullet2: "AI đọc profile rồi so khớp từng tin theo skill, kinh nghiệm và mức lương — chỉ giữ lại job đáng để ứng tuyển.",
    bullet3: "Job khớp tự bay đến tận nơi ngay khi xuất hiện — hết cảnh ngày nào cũng phải canh tin.",
    cta: "Đăng ký nhận Alert",
    phoneHeader: "TalentPuse Bot",
    sourcesLabel: "VietnamWorks · ITviec · LinkedIn",
    matchLabel: "phù hợp",
    justNow: "vừa xong",
    alerts: {
      fintech: { company: "Công ty Fintech · Quận 1", title: "Senior React Developer" },
      startup: { company: "Product Startup · TP.HCM", title: "AI/ML Engineer" },
      saas: { company: "Global SaaS · Remote", title: "DevOps Engineer" },
    },
  },
  aiDemo: {
    badge: "AI-native · Trò chuyện",
    heading: "Trò chuyện với AI để quản lý ứng tuyển",
    sub: "Không form, không bảng thủ công — chỉ cần hỏi. AI theo dõi mọi đơn bạn ứng tuyển, nhắc follow-up và soạn sẵn bước tiếp theo.",
    windowTitle: "TalentPuse AI",
    windowSubtitle: "Trợ lý ứng tuyển",
    q1: "Tuần này tôi cần làm gì với các job đã ứng tuyển?",
    a1Intro: "Bạn đang theo dõi 4 đơn. Ưu tiên tuần này:",
    cards: [
      { role: "DevOps Engineer", company: "Global SaaS", note: "Cần follow-up", tone: "warn" },
      { role: "Senior React Developer", company: "Fintech Q1", note: "Phỏng vấn thứ 5", tone: "info" },
    ],
    q2: "Soạn giúp mình email follow-up Global SaaS nhé",
    a2Typing:
      "Xong! Mình đã soạn email follow-up cho Global SaaS — nhã nhặn, nhắc lại mức độ quan tâm và hỏi về timeline phản hồi. Bạn xem lại rồi gửi nhé.",
    inputPlaceholder: "Hỏi AI về ứng tuyển của bạn…",
    chips: ["Theo dõi trạng thái", "Nhắc follow-up đúng lúc", "Soạn email tự động", "Gợi ý bước tiếp theo"],
    cta: "Trò chuyện với AI",
    caption: "Demo minh họa",
  },
  bento: {
    heading: "Một nền tảng, cả hành trình sự nghiệp",
    sub: "Từ tìm việc, quản lý ứng tuyển đến định giá bản thân — tất cả gói gọn trong TalentPuse.",
    coach: {
      title: "AI Career Coach",
      desc: "Trò chuyện với AI để định hướng skill, lương và lộ trình — dựa trên dữ liệu thị trường thật.",
    },
    alerts: { title: "Job Alerts", desc: "Nhận job khớp profile qua Telegram & Email." },
    salary: { title: "Benchmark lương", desc: "So sánh lương theo cấp bậc, thành phố và kỹ năng." },
    skillgap: { title: "Phân tích Skill Gap", desc: "Biết chính xác cần học gì để lên level tiếp theo." },
    tracker: {
      title: "Quản lý ứng tuyển",
      desc: "Lưu mọi job đã apply, theo dõi trạng thái và để AI nhắc bạn follow-up đúng lúc — không bỏ sót cơ hội.",
      badge: "Chính",
    },
    interview: { title: "Luyện phỏng vấn", desc: "Mock interview với AI, nhận feedback tức thì." },
  },
  studentFeatures: {
    badge: "Dành cho Sinh viên",
    heading: "Khởi đầu sự nghiệp đúng cách",
    sub: "TalentPuse hỗ trợ sinh viên từ A đến Z — từ tìm việc đến phỏng vấn thành công.",
    jobSearch: {
      title: "Tìm việc thông minh",
      description: "AI match internship và fresher job hợp với ngành học, kỹ năng và mức lương mong muốn của bạn.",
    },
    cvReview: {
      title: "Chỉnh sửa CV chuyên nghiệp",
      description: "Gợi ý cải thiện CV theo đúng tiêu chuẩn tuyển dụng thực tế tại Việt Nam.",
    },
    mockInterview: {
      title: "Luyện phỏng vấn",
      description: "Bộ câu hỏi phỏng vấn phổ biến theo ngành, kèm mẹo trả lời từ HR chuyên nghiệp.",
    },
    tips: {
      title: "Tips đi phỏng vấn",
      description: "Hướng dẫn chuẩn bị phỏng vấn, dress code, cách trả lời câu hỏi lương và negotiate offer.",
    },
    cta: "Bắt đầu miễn phí cho sinh viên",
  },
  faq: {
    heading: "Câu hỏi thường gặp",
    sub: "Những điều bạn có thể đang thắc mắc trước khi bắt đầu.",
    items: [
      {
        q: "TalentPuse có miễn phí không?",
        a: "Có. Toàn bộ tính năng hiện tại đều miễn phí cho người tìm việc.",
      },
      {
        q: "Dữ liệu lấy từ đâu?",
        a: "Tổng hợp từ tin đăng công khai trên VietnamWorks, ITviec và LinkedIn, rồi chuẩn hóa bằng pipeline tự động.",
      },
      {
        q: "Alert được gửi qua kênh nào?",
        a: "Qua Telegram và Email, với tần suất do bạn tự chọn.",
      },
      {
        q: "Số liệu lương có chính xác không?",
        a: "Được tổng hợp từ các tin có công khai lương — phản ánh mặt bằng thị trường và mang tính tham khảo.",
      },
      {
        q: "Muốn hủy thông báo thì làm sao?",
        a: "Tắt trong trang Hồ sơ chỉ với một chạm, bất cứ lúc nào.",
      },
    ],
  },
  cta: {
    heading: "Đừng để job hot vuột mất.",
    sub: "AI tìm việc cho bạn từ hôm nay — hoàn toàn miễn phí.",
    button: "Tạo tài khoản trong 30 giây",
    note: "Không cần thẻ · Hủy bất cứ lúc nào",
  },
  footer: {
    tagline: "Phân tích thị trường tuyển dụng IT/AI Việt Nam. Dữ liệu thật, AI thật, cho người Việt trẻ.",
    product: "Sản phẩm",
    resources: "Tài nguyên",
    legal: "Pháp lý",
    connect: "Kết nối",
    links: {
      dashboard: "Dashboard",
      jobs: "Việc làm",
      assistant: "AI Assistant",
      interview: "Mock Interview",
      tracker: "Ứng tuyển",
      faq: "FAQ",
      pipeline: "Ứng tuyển AI",
      data: "Dữ liệu thị trường",
      privacy: "Chính sách bảo mật",
      terms: "Điều khoản",
      telegram: "Telegram Bot",
    },
    copyright: "© 2026 TalentPuse. Xây dựng cho cộng đồng công nghệ Việt Nam.",
  },
};

const en: typeof vi = {
  nav: {
    features: "Features",
    data: "Data",
    pipeline: "AI Agent",
    students: "Students",
    faq: "FAQ",
    signIn: "Sign in",
    signUp: "Try it free",
  },
  hero: {
    badge: "Find jobs · Track applications · AI by your side",
    lead: "From applying to offer, ",
    highlight: "let AI walk with you",
    tail: ".",
    sub: "TalentPuse helps you find the right IT jobs, manage every application in one place, and get AI follow-up reminders and advice along the way — so no chance to land a job slips by.",
    ctaPrimary: "Get started free",
    ctaSecondary: "Watch the AI work",
  },
  heroDemo: {
    title: "Your applications",
    aiLabel: "AI tracking",
    insight: "You're tracking {total} jobs. {followups} need follow-up, {interviews} interview this week.",
    caption: "Illustrative demo",
    statuses: {
      applied: "Applied",
      interviewing: "Interview",
      offer: "Offer",
    },
    followUp: "Follow up",
  },
  statsStrip: {
    jobsAnalyzed: "job postings analyzed",
    companies: "hiring companies",
    skillsTracked: "skills tracked",
    refresh: "data refresh cycle",
    sourcesPrefix: "Aggregated from",
    ticker: { jobsUnit: "jobs", salaryUnit: "M/mo", trend: "YoY" },
  },
  dataStory: {
    badge: "Market data",
    heading: "What the data says",
    sub: "Not guesswork — the aggregate picture from thousands of IT job postings across Vietnam.",
    chartTitle: "Most in-demand skills",
    chartUnit: "posts",
    salaryExplorer: {
      title: "What will you earn?",
      levelLabel: "Level",
      cityLabel: "City",
      medianLabel: "Median",
      rangeLabel: "Common range",
      unit: "M VND/month",
      levels: {
        intern: "Intern",
        fresher: "Fresher",
        junior: "Junior",
        middle: "Middle",
        senior: "Senior",
      },
      cities: { hcm: "HCMC", hanoi: "Hanoi", danang: "Da Nang" },
    },
    topPaying: {
      title: "Highest-paying skills",
      colSkill: "Skill",
      colSalary: "Avg salary",
      colJobs: "Posts",
      unit: "M",
    },
  },
  alertShowcase: {
    badge: "Key feature",
    heading: "The right jobs find you",
    sub: "Stop scrolling VietnamWorks, ITviec and LinkedIn every day. TalentPuse pulls jobs from all three into one place, so AI can filter and ping you only on real matches.",
    bullet1: "Aggregates jobs from multiple sources — VietnamWorks, ITviec, LinkedIn — into one feed, so you don't open each site daily.",
    bullet2: "AI reads your profile and matches each posting by skill, experience and salary — keeping only jobs worth applying to.",
    bullet3: "Matching jobs come straight to you the moment they appear — no more daily job hunting.",
    cta: "Sign up for Alerts",
    phoneHeader: "TalentPuse Bot",
    sourcesLabel: "VietnamWorks · ITviec · LinkedIn",
    matchLabel: "match",
    justNow: "just now",
    alerts: {
      fintech: { company: "Fintech Co. · District 1", title: "Senior React Developer" },
      startup: { company: "Product Startup · HCMC", title: "AI/ML Engineer" },
      saas: { company: "Global SaaS · Remote", title: "DevOps Engineer" },
    },
  },
  aiDemo: {
    badge: "AI-native · Conversational",
    heading: "Chat with AI to manage your applications",
    sub: "No forms, no manual spreadsheets — just ask. AI tracks every job you apply to, reminds you to follow up and drafts the next step.",
    windowTitle: "TalentPuse AI",
    windowSubtitle: "Application assistant",
    q1: "What should I do with my applications this week?",
    a1Intro: "You're tracking 4 applications. Priorities this week:",
    cards: [
      { role: "DevOps Engineer", company: "Global SaaS", note: "Needs follow-up", tone: "warn" },
      { role: "Senior React Developer", company: "Fintech Q1", note: "Interview Thu", tone: "info" },
    ],
    q2: "Draft a follow-up email to Global SaaS for me",
    a2Typing:
      "Done! I've drafted a follow-up email to Global SaaS — polite, restating your interest and asking about their timeline. Review it and hit send.",
    inputPlaceholder: "Ask AI about your applications…",
    chips: ["Status tracking", "Timely follow-up nudges", "Auto-drafted emails", "Next-step suggestions"],
    cta: "Chat with AI",
    caption: "Illustrative demo",
  },
  bento: {
    heading: "One platform, your whole career journey",
    sub: "From finding jobs and managing applications to pricing yourself — all inside TalentPuse.",
    coach: {
      title: "AI Career Coach",
      desc: "Chat with AI to plan your skills, salary and roadmap — grounded in real market data.",
    },
    alerts: { title: "Job Alerts", desc: "Get profile-matched jobs via Telegram & Email." },
    salary: { title: "Salary benchmark", desc: "Compare pay by level, city and skill." },
    skillgap: { title: "Skill Gap analysis", desc: "Know exactly what to learn to reach the next level." },
    tracker: {
      title: "Application manager",
      desc: "Save every application, track its status, and let AI remind you to follow up on time — never miss an opportunity.",
      badge: "Core",
    },
    interview: { title: "Mock interviews", desc: "Practice with AI and get instant feedback." },
  },
  studentFeatures: {
    badge: "For Students",
    heading: "Kick-start your career the right way",
    sub: "TalentPuse supports students from A to Z — from job hunting to interview success.",
    jobSearch: {
      title: "Smart job search",
      description: "AI matches internships and fresher jobs to your major, skills and desired salary.",
    },
    cvReview: {
      title: "Professional CV review",
      description: "Suggestions to improve your CV against real hiring standards in Vietnam.",
    },
    mockInterview: {
      title: "Mock interviews",
      description: "Common interview questions by industry, with answer tips from professional HR.",
    },
    tips: {
      title: "Interview tips",
      description: "Guides on interview prep, dress code, answering salary questions and negotiating offers.",
    },
    cta: "Get started free for students",
  },
  faq: {
    heading: "Frequently asked questions",
    sub: "Things you might be wondering before you start.",
    items: [
      {
        q: "Is TalentPuse free?",
        a: "Yes. Every current feature is free for job seekers.",
      },
      {
        q: "Where does the data come from?",
        a: "Aggregated from public postings on VietnamWorks, ITviec and LinkedIn, then normalized by an automated pipeline.",
      },
      {
        q: "Which channels do alerts use?",
        a: "Telegram and Email, at a frequency you choose.",
      },
      {
        q: "Are the salary figures accurate?",
        a: "They're aggregated from postings that disclose salary — reflecting market rates as a reference point.",
      },
      {
        q: "How do I unsubscribe from alerts?",
        a: "Turn them off in your Profile page with one tap, anytime.",
      },
    ],
  },
  cta: {
    heading: "Don't let hot jobs slip away.",
    sub: "Let AI find jobs for you starting today — completely free.",
    button: "Create an account in 30 seconds",
    note: "No card required · Cancel anytime",
  },
  footer: {
    tagline: "Vietnam IT/AI job market intelligence. Real data, real AI, for young Vietnamese devs.",
    product: "Product",
    resources: "Resources",
    legal: "Legal",
    connect: "Connect",
    links: {
      dashboard: "Dashboard",
      jobs: "Jobs",
      assistant: "AI Assistant",
      interview: "Mock Interview",
      tracker: "Applications",
      faq: "FAQ",
      pipeline: "AI tracking",
      data: "Market data",
      privacy: "Privacy Policy",
      terms: "Terms",
      telegram: "Telegram Bot",
    },
    copyright: "© 2026 TalentPuse. Built for Vietnam's tech community.",
  },
};

export const translations = { vi, en } as const;
export type LandingCopy = typeof vi;
