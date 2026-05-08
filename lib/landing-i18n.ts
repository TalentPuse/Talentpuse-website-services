export type Lang = "vi" | "en";

const vi = {
  nav: {
    features: "Tính năng",
    signIn: "Đăng nhập",
    signUp: "Đăng ký miễn phí",
  },
  hero: {
    badge: "AI Job Alert",
    heading1: "Nắm bắt thị trường tuyển dụng ",
    heading2: "Việt Nam",
    sub: "Phân tích dữ liệu từ hơn 10 nguồn tuyển dụng, tự động match job phù hợp với bạn và gửi alert tức thì qua Telegram, Zalo, Discord.",
    ctaPrimary: "Đăng ký Alert miễn phí",
    ctaSecondary: "Đăng nhập",
  },
  stats: {
    sources: "Nguồn dữ liệu",
    jobs: "Jobs được theo dõi",
    realtime: "Cập nhật realtime",
    channels: "Kênh thông báo",
  },
  aiAlert: {
    badge: "Tính năng nổi bật",
    heading: "AI tự động tìm job\nphù hợp với bạn",
    description: "Thay vì lướt hàng trăm tin tuyển dụng mỗi ngày, để AI Agent làm việc đó. Chỉ nhận thông báo khi có job thật sự match với profile và kỹ năng của bạn.",
    bullet1Title: "AI phân tích profile",
    bullet1: ", match job chính xác theo skills, kinh nghiệm và mức lương mong muốn",
    bullet2Title: "Thông báo tức thì",
    bullet2: ", nhận alert qua Telegram, Zalo, Discord hoặc trực tiếp trên website",
    bullet3Title: "Không bỏ lỡ",
    bullet3: ", job hot đến tay bạn đầu tiên, trước cả khi đăng rộng rãi",
    cta: "Đăng ký nhận Alert",
    sentVia: "Gửi qua:",
  },
  notifications: {
    match: "Phù hợp",
    minAgo: "phút trước",
    hourAgo: "giờ trước",
  },
  howItWorks: {
    badge: "Quy trình",
    heading: "Cách hoạt động",
    sub: "Hệ thống tự động thu thập, phân tích và gửi thông báo việc làm phù hợp đến bạn chỉ trong 3 bước",
    step1: {
      title: "Thu thập dữ liệu",
      description: "Hệ thống tự động thu thập hàng nghìn tin tuyển dụng từ hơn 10 nguồn uy tín tại Việt Nam. Dữ liệu được cập nhật liên tục mỗi ngày để đảm bảo độ chính xác và kịp thời.",
    },
    step2: {
      title: "Phân tích chuyên sâu",
      description: "Hệ thống xử lý và tổng hợp dữ liệu thành các báo cáo chi tiết về kỹ năng thị trường cần, mức lương theo vị trí, doanh nghiệp đang tuyển và xu hướng ngành nghề.",
    },
    step3: {
      title: "Thông báo và báo cáo",
      description: "Theo dõi thị trường qua dashboard trực quan hoặc nhận thông báo việc làm phù hợp với hồ sơ của bạn qua Telegram, Zalo và Discord.",
    },
  },
  studentFeatures: {
    comingSoon: "Sắp ra mắt",
    badge: "Dành cho Sinh viên",
    heading: "Khởi đầu sự nghiệp đúng cách",
    sub: "TalentPuse hỗ trợ sinh viên từ A đến Z — từ tìm việc đến phỏng vấn thành công",
    jobSearch: {
      title: "Tìm việc thông minh",
      description: "AI tự động match internship và fresher job phù hợp với ngành học, kỹ năng và mức lương mong muốn của bạn",
    },
    cvReview: {
      title: "Chỉnh sửa CV chuyên nghiệp",
      description: "Gợi ý cải thiện CV dựa trên tiêu chuẩn tuyển dụng thực tế tại Việt Nam",
    },
    mockInterview: {
      title: "Luyện phỏng vấn",
      description: "Bộ câu hỏi phỏng vấn phổ biến theo ngành, kèm mẹo trả lời từ HR chuyên nghiệp",
    },
    tips: {
      title: "Tips đi phỏng vấn",
      description: "Hướng dẫn chuẩn bị phỏng vấn, dress code, cách trả lời câu hỏi lương và negotiate offer",
    },
    cta: "Đăng ký dành cho Sinh viên",
  },
  cta: {
    heading: "Đừng để job hot vuột mất",
    sub: "Đăng ký để AI tự động tìm và gửi alert job phù hợp với bạn. Hoàn toàn miễn phí.",
    button: "Đăng ký miễn phí",
    orSignIn: "hoặc đăng nhập",
  },
  footer: {
    tagline: "Phân tích thị trường tuyển dụng IT/AI Việt Nam. AI tự động match job và gửi alert tức thì.",
    product: "Sản phẩm",
    connect: "Kết nối",
    dashboard: "Dashboard",
    features: "Tính năng",
    signUp: "Đăng ký",
    copyright: "© 2026 TalentPuse. Xây dựng cho cộng đồng công nghệ Việt Nam.",
  },
};

const en: typeof vi = {
  nav: {
    features: "Features",
    signIn: "Sign in",
    signUp: "Sign up free",
  },
  hero: {
    badge: "AI Job Alert. Never miss an opportunity",
    heading1: "Master the job market in ",
    heading2: "Vietnam",
    sub: "Analyze data from 10+ recruitment sources, automatically match jobs to your profile, and receive instant alerts via Telegram, Zalo, Discord.",
    ctaPrimary: "Sign up for free Alerts",
    ctaSecondary: "Sign in",
  },
  stats: {
    sources: "Data sources",
    jobs: "Jobs tracked",
    realtime: "Realtime updates",
    channels: "Alert channels",
  },
  aiAlert: {
    badge: "Key Feature",
    heading: "AI finds the right jobs\nfor you automatically",
    description: "Instead of scrolling through hundreds of listings every day, let our AI Agent do the work. Get notified only when a job truly matches your profile and skills.",
    bullet1Title: "AI analyzes your profile",
    bullet1: ", matching jobs precisely by skills, experience, and desired salary",
    bullet2Title: "Instant alerts",
    bullet2: ", receive notifications via Telegram, Zalo, Discord or directly on the website",
    bullet3Title: "Never miss out",
    bullet3: ", hot jobs reach you first, before they're widely posted",
    cta: "Sign up for Alerts",
    sentVia: "Sent via:",
  },
  notifications: {
    match: "Match",
    minAgo: "min ago",
    hourAgo: "hour ago",
  },
  howItWorks: {
    badge: "Process",
    heading: "How it works",
    sub: "Our system automatically collects, analyzes, and sends matching job alerts to you in just 3 steps",
    step1: {
      title: "Data collection",
      description: "The system automatically collects thousands of job listings from 10+ trusted sources in Vietnam. Data is continuously updated daily to ensure accuracy and timeliness.",
    },
    step2: {
      title: "Deep analysis",
      description: "The system processes and synthesizes data into detailed reports on market-demanded skills, salary by position, hiring companies, and industry trends.",
    },
    step3: {
      title: "Alerts & reports",
      description: "Track the market via a visual dashboard or receive job alerts matching your profile via Telegram, Zalo, and Discord.",
    },
  },
  studentFeatures: {
    comingSoon: "Coming soon",
    badge: "For Students",
    heading: "Kick-start your career the right way",
    sub: "TalentPuse supports students from A to Z — from job hunting to interview success",
    jobSearch: {
      title: "Smart job search",
      description: "AI automatically matches internships and fresher jobs that fit your major, skills, and desired salary",
    },
    cvReview: {
      title: "Professional CV review",
      description: "Suggestions to improve your CV based on real hiring standards in Vietnam",
    },
    mockInterview: {
      title: "Mock interviews",
      description: "Common interview questions by industry, with answer tips from professional HR",
    },
    tips: {
      title: "Interview tips",
      description: "Guides on interview prep, dress code, how to answer salary questions and negotiate offers",
    },
    cta: "Sign up for Students",
  },
  cta: {
    heading: "Don't let hot jobs slip away",
    sub: "Sign up for AI to automatically find and alert you about matching jobs. Completely free.",
    button: "Sign up for free",
    orSignIn: "or sign in",
  },
  footer: {
    tagline: "Vietnam IT/AI job market intelligence. AI matches jobs to your profile and sends instant alerts.",
    product: "Product",
    connect: "Connect",
    dashboard: "Dashboard",
    features: "Features",
    signUp: "Sign up",
    copyright: "© 2026 TalentPuse. Built for Vietnam's tech community.",
  },
};

export const translations = { vi, en } as const;
