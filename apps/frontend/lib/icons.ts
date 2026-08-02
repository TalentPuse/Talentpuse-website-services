/**
 * Sanctioned lucide-react icon set + sizing convention for the dashboard.
 *
 * Import icons from here (not directly from "lucide-react") so the set stays
 * curated, and spread `ICON` onto every icon instance for a consistent
 * size/stroke across the app:
 *
 *   import { Sparkles, ICON } from "@/lib/icons";
 *   <Sparkles {...ICON} />
 */
export {
  Sparkles,
  Bot,
  MessageSquare,
  Send,
  Paperclip,
  Mic,
  Search,
  History,
  Settings,
  Plus,
  Download,
  Command,
  FileText,
  Briefcase,
  ScanSearch,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard,
  Bell,
  Inbox,
  User,
  LogOut,
  MapPin,
  Building2,
  ChevronRight,
  Mail,
  ClipboardCheck,
  Check,
  Trash2,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  ChevronDown,
  BarChart3,
  LineChart,
  Database,
  Brain,
  BadgeDollarSign,
  Target,
  Play,
  RotateCcw,
  GraduationCap,
  Layers,
  Zap,
  ShieldCheck,
} from "lucide-react";

export const ICON = { size: 20, strokeWidth: 1.75 } as const;
