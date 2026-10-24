'use client';

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Building2,
  Lock,
  LogOut,
  Phone,
  Recycle,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCheck,
} from 'lucide-react';
import { LeaderboardView } from '@/components/LeaderboardView';
import { ClubProfilesView } from '@/components/ClubProfilesView';
import { VerificationEngineView } from '@/components/VerificationEngineView';
import { WhatsAppCloudWorkbench } from '@/components/WhatsAppCloudWorkbench';
import { HealthRiskDashboardView } from '@/components/HealthRiskDashboardView';
import { StudentGamifiedDashboardView } from '@/components/StudentGamifiedDashboardView';
import { RoleLoginPortalView } from '@/components/RoleLoginPortalView';
import { AuthLoginPromptModal } from '@/components/AuthLoginPromptModal';
import { fetchPlatformSnapshotClient } from '@/lib/client/platform-bridge';
import {
  AuditLogEntry,
  Club,
  GamificationConfig,
  HealthRiskAlert,
  ImpactLog,
  LeaderboardSchoolScore,
  School,
  TelegramBotOutboundMessage,
  UserProfile,
  WhatsAppBotOutboundMessage,
} from '@/types/domain';

type NavTab =
  | 'leaderboard'
  | 'student_gamified'
  | 'verification'
  | 'clubs'
  | 'whatsapp_ingestion'
  | 'health_risk'
  | 'login_portal';

interface SnapshotData {
  schools: School[];
  clubs: Club[];
  users: UserProfile[];
  impactLogs: ImpactLog[];
  auditLogs: AuditLogEntry[];
  gamificationConfig: GamificationConfig;
  whatsappMessages: WhatsAppBotOutboundMessage[];
  telegramMessages?: TelegramBotOutboundMessage[];
  leaderboard: LeaderboardSchoolScore[];
  healthAlerts: HealthRiskAlert[];
}

export default function PlatformDashboardPage() {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('login_portal');
  const [activeUserId, setActiveUserId] = useState<string>('usr-giz-admin-01');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginPromptReason, setLoginPromptReason] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string>('club-01');

  useEffect(() => {
    let isMounted = true;

    const refreshData = () => {
      fetchPlatformSnapshotClient().then((data) => {
        if (!isMounted) return;
        setSnapshot(data);
      });
    };

    // Initial load & authentication state recovery
    fetchPlatformSnapshotClient().then((data) => {
      if (!isMounted) return;
      setSnapshot(data);
      if (typeof window !== 'undefined') {
        let savedUserId =
          localStorage.getItem('i2i_auth_user_id') ||
          localStorage.getItem('haritha_auth_user_id');
        if (!savedUserId) {
          const match = document.cookie.match(/(?:i2i_auth_user_id|haritha_auth_user_id)=([^;]+)/);
          if (match) savedUserId = match[1];
        }
        if (savedUserId) {
          const user = data.users.find(
            (u: UserProfile) => u.id === savedUserId || u.auth_user_id === savedUserId
          );
          if (user) {
            setActiveUserId(user.id);
            setIsAuthenticated(true);
            if (user.role === 'super_admin' || user.role === 'admin') setActiveTab('leaderboard');
            else if (user.role === 'expert_admin' || user.role === 'expert') setActiveTab('verification');
            else if (user.role === 'teacher') setActiveTab('verification');
            else if (user.role === 'student') setActiveTab('student_gamified');
            return;
          } else if (savedUserId === 'e6535656-badd-447f-bf31-dbf208e68871' || savedUserId === 'usr-giz-superadmin-budhikka') {
            setActiveUserId(savedUserId);
            setIsAuthenticated(true);
            setActiveTab('leaderboard');
            return;
          }
        }
        // Unauthenticated by default: direct user to login portal
        setIsAuthenticated(false);
        setActiveTab('login_portal');
      }
    });

    // Real-time synchronization polling every 4 seconds (captures live WhatsApp activity logs)
    const interval = setInterval(refreshData, 4000);

    // Refresh on window focus (e.g., when teacher returns from WhatsApp app)
    const handleFocus = () => refreshData();
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const activeUser = snapshot
    ? snapshot.users.find((u) => u.id === activeUserId || u.auth_user_id === activeUserId) || snapshot.users[0]
    : null;

  const handleSwitchUser = (newUserId: string, targetTab?: NavTab) => {
    setActiveUserId(newUserId);
    setIsAuthenticated(true);
    if (typeof document !== 'undefined') {
      document.cookie = `i2i_auth_user_id=${newUserId}; path=/; max-age=2592000; SameSite=Lax`;
      document.cookie = `haritha_auth_user_id=; path=/; max-age=0; SameSite=Lax`;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('i2i_auth_user_id', newUserId);
      localStorage.removeItem('haritha_auth_user_id');
    }
    const found = snapshot?.users.find((u) => u.id === newUserId || u.auth_user_id === newUserId);
    if (found?.club_id) {
      setSelectedClubId(found.club_id);
    }
    if (targetTab) {
      setActiveTab(targetTab);
    } else if (found?.role === 'super_admin' || found?.role === 'admin') {
      setActiveTab('leaderboard');
    } else if (found?.role === 'expert_admin' || found?.role === 'expert') {
      setActiveTab('verification');
    } else if (found?.role === 'teacher') {
      setActiveTab('verification');
    } else if (found?.role === 'student') {
      setActiveTab('student_gamified');
    }
    setIsLoginModalOpen(false);
  };

  const handleModalSelectUser = (user: UserProfile) => {
    handleSwitchUser(user.id);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof document !== 'undefined') {
      document.cookie = 'i2i_auth_user_id=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'haritha_auth_user_id=; path=/; max-age=0; SameSite=Lax';
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('i2i_auth_user_id');
      localStorage.removeItem('haritha_auth_user_id');
    }
    setActiveTab('login_portal');
    setIsLoginModalOpen(false);
  };

  const handleTabClick = (tabId: NavTab) => {
    if (!isAuthenticated) {
      setActiveTab('login_portal');
      return;
    }
    setActiveTab(tabId);
  };

  const pendingTeacherCount =
    snapshot && activeUser
      ? snapshot.impactLogs.filter(
          (l) => (l.status === 'pending' || l.status === 'flagged') && l.school_id === activeUser.school_id
        ).length
      : 0;

  const pendingExpertCount = snapshot
    ? snapshot.impactLogs.filter(
        (l) =>
          l.status === 'pending_expert_review' ||
          (l.random_audit_selected && l.audit_status === 'pending_audit')
      ).length
    : 0;

  // Role-customized navigation items (Shows ONLY tabs relevant to active user profile)
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = (() => {
    if (!snapshot || !activeUser || !isAuthenticated) {
      return [];
    }

    // Category 1: GIZ Super Admin Dashboard
    if (activeUser.role === 'super_admin' || activeUser.role === 'admin') {
      return [
        {
          id: 'leaderboard' as NavTab,
          label: '15-School National Index',
          icon: Trophy,
        },
        {
          id: 'verification' as NavTab,
          label: 'Algorithm & Policy Weights',
          icon: ShieldCheck,
        },
        {
          id: 'health_risk' as NavTab,
          label: 'GIZ Risk Alerts & Health',
          icon: Activity,
          count: snapshot.healthAlerts.length,
        },
        {
          id: 'clubs' as NavTab,
          label: 'All 15 School Enterprises',
          icon: Building2,
        },
      ];
    }

    // Category 2: National Expert Panel Evaluator Dashboard
    if (activeUser.role === 'expert_admin' || activeUser.role === 'expert') {
      return [
        {
          id: 'verification' as NavTab,
          label: 'Expert Scoring & Audit Queue',
          icon: ShieldCheck,
          count: pendingExpertCount,
        },
        {
          id: 'whatsapp_ingestion' as NavTab,
          label: 'WhatsApp Invoices & Dossiers',
          icon: Phone,
        },
        {
          id: 'leaderboard' as NavTab,
          label: 'National School Leaderboard',
          icon: Trophy,
        },
        {
          id: 'clubs' as NavTab,
          label: 'School Enterprise Dossiers',
          icon: Building2,
        },
      ];
    }

    // Category 3: School Supervising Teacher Dashboard (Per School)
    if (activeUser.role === 'teacher') {
      return [
        {
          id: 'verification' as NavTab,
          label: `${activeUser.school_code || 'School'} Pending Approvals`,
          icon: ShieldCheck,
          count: pendingTeacherCount,
        },
        {
          id: 'whatsapp_ingestion' as NavTab,
          label: 'Activity & Receipt Approval',
          icon: Phone,
        },
        {
          id: 'clubs' as NavTab,
          label: `${activeUser.school_code || 'Our School'} Enterprise`,
          icon: Building2,
        },
        {
          id: 'leaderboard' as NavTab,
          label: 'National School Index',
          icon: Trophy,
        },
      ];
    }

    // Category 4: School Student Club Dashboard (15 Single-User School Logins)
    if (activeUser.role === 'student') {
      return [
        {
          id: 'student_gamified' as NavTab,
          label: `${activeUser.school_code || 'Our School'} Gamified Club`,
          icon: Sparkles,
        },
        {
          id: 'whatsapp_ingestion' as NavTab,
          label: '📱 WhatsApp Activity Hub',
          icon: Phone,
        },
        {
          id: 'leaderboard' as NavTab,
          label: 'National School Leaderboard',
          icon: Trophy,
        },
      ];
    }

    return [
      {
        id: 'leaderboard' as NavTab,
        label: 'National School Leaderboard',
        icon: Trophy,
      },
    ];
  })();

  const navTabKey = navItems.map((n) => n.id).join(',');

  // Synchronize activeTab if it doesn't belong to current role's navigation
  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((item) => item.id === activeTab)) {
      setActiveTab(navItems[0].id);
    }
  }, [navTabKey, activeTab]);

  if (!snapshot || !activeUser) {
    return (
      <div className="min-h-screen bg-[#E6F1FA] flex items-center justify-center p-6">
        <div className="hai-card px-6 py-4 flex items-center gap-3 text-[#005FA3] font-semibold text-sm shadow-xs">
          <Recycle className="w-5 h-5 animate-spin" />
          <span>Loading I2I Clubs (Idea2Impact) • Sri Lanka School Circular Index...</span>
        </div>
      </div>
    );
  }

  // Role-customized Page Editorial Headers
  const getPageHeaderMeta = () => {
    if (!isAuthenticated) {
      return {
        eyebrow: 'Universal Authentication Gateway • Zero-Trust Security',
        title: 'Sign In to Your Dashboard',
        subtitle:
          'Authentication required. Enter your Login ID, School Code, or Email address to access school circular metrics, teacher approvals, and expert evaluation ledgers.',
        badge: 'Zero-Trust RBAC',
      };
    }


    if (activeUser.role === 'super_admin' || activeUser.role === 'admin') {
      if (activeTab === 'verification') {
        return {
          eyebrow: 'Category 1 • GIZ Sri Lanka National Office (Program Oversight)',
          title: 'Scoring Algorithm & Policy Weights',
          subtitle:
            'Configure the environmental-to-financial normalization ratio, macro revenue threshold (> Rs. 15,000), and 6 criteria weights for national grants.',
          badge: 'GIZ Governance',
        };
      }
      if (activeTab === 'health_risk') {
        return {
          eyebrow: 'Category 1 • GIZ Sri Lanka National Program Office (Program Lead)',
          title: 'GIZ Program Governance & Integrity Engine',
          subtitle:
            'National monitoring of 15 participating Sri Lankan school enterprises, inactive club alerts (>14 days), GPS campus perimeter violations, and fraud audit ledger.',
          badge: `${snapshot.healthAlerts.length} Active Alerts`,
        };
      }
      if (activeTab === 'clubs') {
        return {
          eyebrow: 'Category 1 • GIZ Sri Lanka National Directory',
          title: 'All 15 School Enterprise Clubs',
          subtitle:
            'Review club business canvases, teachers-in-charge, and verified activity histories across Western, Central, Southern & Northern provinces.',
          badge: '15 Enterprises',
        };
      }
      return {
        eyebrow: 'Category 1 • GIZ Sri Lanka National Oversight',
        title: 'National School Circular Index (GIZ View)',
        subtitle:
          'Program-wide ranking of all 15 schools with verified waste diverted, enterprise sales generated, and seed grant allocations.',
        badge: '15 Schools',
      };
    }

    if (activeUser.role === 'expert_admin' || activeUser.role === 'expert') {
      if (activeTab === 'whatsapp_ingestion') {
        return {
          eyebrow: 'Category 2 • National Expert Evaluation Panel',
          title: 'Teacher WhatsApp Invoices & Scoring Dossiers',
          subtitle:
            'Review official sales invoices, bookshop receipts, and weighbridge scale tickets uploaded by supervising teachers, and score via WhatsApp or web.',
          badge: 'WhatsApp Dossier Review',
        };
      }
      if (activeTab === 'leaderboard') {
        return {
          eyebrow: 'Category 2 • National Expert Evaluation Panel',
          title: 'National School Composite Leaderboard',
          subtitle:
            'Live composite rankings calculated using the 6 core criteria weights (Relevance, Business, Feasibility, Leadership, Sustainability, Commitment).',
          badge: 'Live Rankings',
        };
      }
      if (activeTab === 'clubs') {
        return {
          eyebrow: 'Category 2 • National Expert Evaluation Panel',
          title: 'Participating School Enterprise Dossiers',
          subtitle:
            'Inspect baseline criteria, business model canvases, and student enterprise records across all 15 schools.',
          badge: '15 Schools',
        };
      }
      return {
        eyebrow: 'Category 2 • National Expert Evaluation Panel',
        title: 'Expert Adjudication & Criteria Scoring Queue',
        subtitle:
          'Score high-impact enterprise sales (> Rs. 15,000) across 6 selection criteria, and adjudicate the 10% random micro transaction integrity sample.',
        badge: `${pendingExpertCount} In Queue`,
      };
    }

    if (activeUser.role === 'teacher') {
      if (activeTab === 'whatsapp_ingestion') {
        return {
          eyebrow: `Category 3 • Supervising Teacher • ${activeUser.school_name} (${activeUser.school_code})`,
          title: 'Teacher Activity & Receipt Approval',
          subtitle:
            'Attach verified sales invoices, pola receipts, or waste weighbridge scale tickets for transactions > Rs. 15,000 to forward to GIZ & Expert Panel.',
          badge: `${activeUser.school_code} Activity Approval`,
        };
      }
      if (activeTab === 'clubs') {
        return {
          eyebrow: `Category 3 • Supervising Teacher • ${activeUser.school_name} (${activeUser.school_code})`,
          title: `${activeUser.school_name} Eco Club Enterprise`,
          subtitle: `Our school’s student office bearers, circular feedstocks, active committee, and verified sales ledger.`,
          badge: `${activeUser.school_code} Club`,
        };
      }
      if (activeTab === 'leaderboard') {
        return {
          eyebrow: `Category 3 • Supervising Teacher • ${activeUser.school_name} (${activeUser.school_code})`,
          title: 'National 15-School Rankings & Top-Off Grants',
          subtitle: `Track ${activeUser.school_name}'s national rank, composite score, and progress toward Gold/Platinum seed funding grants.`,
          badge: `${activeUser.school_code} Rank`,
        };
      }
      return {
        eyebrow: `Category 3 • Supervising Teacher • ${activeUser.school_name} (${activeUser.school_code})`,
        title: `${activeUser.school_name} Teacher Approvals Queue`,
        subtitle: `Validate on-campus micro transactions (≤ Rs. 15,000) submitted by our students to award live points and verify school impact.`,
        badge: `${pendingTeacherCount} Pending Approval`,
      };
    }

    // Category 4: Student Role
    if (activeTab === 'whatsapp_ingestion') {
      return {
        eyebrow: `Category 4 • Student Enterprise • ${activeUser.school_name} (${activeUser.school_code})`,
        title: 'WhatsApp Cloud Activity Logger (+94 11 234 5678)',
        subtitle:
          'Log your club activity with a photo, choose what you did, and record the waste recycled and sales made.',
        badge: 'WhatsApp Verified',
      };
    }
    if (activeTab === 'leaderboard') {
      return {
        eyebrow: `Category 4 • Student Enterprise • ${activeUser.school_name} (${activeUser.school_code})`,
        title: 'National School Leaderboard',
        subtitle: `See ${activeUser.school_name}'s current national rank, points gap to the school above, and unlocked seed funding tier.`,
        badge: `${activeUser.school_code} Standing`,
      };
    }
    return {
      eyebrow: `Category 4 • Student Enterprise • ${activeUser.school_name} (${activeUser.school_code})`,
      title: `${activeUser.school_name} Gamified Eco-Enterprise`,
      subtitle:
        'Live XP level progress, 6 milestone quests & badges, friendly rivalry gap, and touch-button activity logging.',
      badge: `${activeUser.school_code} Student Club`,
    };
  };

  const currentMeta = getPageHeaderMeta();
  const gizUsers = snapshot.users.filter((u) => u.role === 'super_admin');
  const expertUsers = snapshot.users.filter((u) => u.role === 'expert_admin');
  const teacherUsers = snapshot.users.filter((u) => u.role === 'teacher');
  const studentUsers = snapshot.users.filter((u) => u.role === 'student');

  return (
    <div className="min-h-screen flex flex-col bg-[#E6F1FA] text-[#111010]">
      {/* ====================================================================
       * Spacious 2-Tier Stanford HAI Style Header (Utility Role Bar + Main Nav)
       * ==================================================================== */}
      <header className="sticky top-0 z-30 bg-[#E6F1FA]/95 backdrop-blur-xs border-b border-[#111010]/15">
        {/* Tier 1: Slim Institutional & Role Switcher Utility Bar */}
        <div className="bg-[#FFFFFF]/90 border-b border-[#111010]/10">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-8 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left: Active Role Indicator or Guest Notice */}
            {isAuthenticated ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="font-bold text-[#111010] text-[11px] sm:text-xs">
                  {activeUser.role === 'super_admin' || activeUser.role === 'admin'
                    ? 'GIZ Sri Lanka • National Program Management Office'
                    : activeUser.role === 'expert_admin' || activeUser.role === 'expert'
                    ? 'National Expert Evaluation Panel • CEA / University Adjudication'
                    : activeUser.role === 'teacher'
                    ? `${activeUser.school_name || 'School'} • Supervising Teacher Dashboard`
                    : `${activeUser.school_name || 'School'} Eco Club • Student Enterprise Portal`}
                </span>
                <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#005FA3]/10 text-[#005FA3] border border-[#005FA3]/20">
                  {activeUser.role === 'super_admin' || activeUser.role === 'admin'
                    ? 'Program Lead'
                    : activeUser.role === 'expert_admin' || activeUser.role === 'expert'
                    ? 'Expert Panel'
                    : activeUser.role === 'teacher'
                    ? `Teacher Validator • ${activeUser.school_code}`
                    : `Student Enterprise • ${activeUser.school_code}`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#111010]/75">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span>
                  <strong>Authentication Required</strong> • Please sign in with your role credentials (GIZ, Expert Panel, School Teacher, or School Student Club).
                </span>
              </div>
            )}

            {/* Right: Active Login Info & Actions */}
            <div className="flex items-center gap-2 ml-auto">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F1FA] border border-[#005FA3]/25 text-[11px] font-bold text-[#005FA3]">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span className="font-mono">{activeUser.login_code}</span>
                    <span className="hidden md:inline text-[#111010]/70 font-normal">
                      • {activeUser.full_name}
                    </span>
                  </div>

                  {(activeUser.role === 'super_admin' || activeUser.role === 'admin') && (
                    <a
                      href="/admin"
                      className="px-3.5 py-1 rounded-full text-[11px] font-semibold bg-[#005FA3] text-[#9CF2F2] border border-[#005FA3] hover:bg-[#0B3E6E] cursor-pointer flex items-center gap-1.5 transition"
                      title="Open the platform management console"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Platform Management</span>
                    </a>
                  )}

                  <button
                    onClick={handleLogout}
                    className="px-3.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer flex items-center gap-1.5 transition"
                    title="Sign Out of Session"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setActiveTab('login_portal');
                  }}
                  className="hai-btn-primary px-4 py-1 text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In to Dashboard</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tier 2: Spacious Main Brand & Primary Navigation Bar */}
        <div className="max-w-[1360px] mx-auto px-4 sm:px-8 h-16 sm:h-[68px] flex items-center justify-between gap-6">
          {/* Left: Clean Brand Lockup */}
          <button
            onClick={() => {
              if (activeUser.role === 'super_admin' || activeUser.role === 'admin') setActiveTab('leaderboard');
              else if (activeUser.role === 'expert_admin' || activeUser.role === 'expert') setActiveTab('verification');
              else if (activeUser.role === 'teacher') setActiveTab('verification');
              else if (activeUser.role === 'student') setActiveTab('student_gamified');
              else setActiveTab('leaderboard');
            }}
            className="flex items-center gap-3 text-left group cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 rounded-[10px_10px_10px_2px] bg-[#005FA3] text-[#9CF2F2] flex items-center justify-center shadow-xs group-hover:bg-[#0B3E6E] transition">
              <Recycle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="flex items-center gap-3">
              <div>
                <div className="text-base sm:text-lg font-bold tracking-tight text-[#111010] leading-none">
                  {isAuthenticated
                    ? activeUser.role === 'super_admin' || activeUser.role === 'admin'
                      ? 'I2I Clubs • GIZ Governance'
                      : activeUser.role === 'expert_admin' || activeUser.role === 'expert'
                      ? 'I2I Clubs • Expert Panel'
                      : activeUser.role === 'teacher'
                      ? `I2I Clubs • ${activeUser.school_code || 'School'}`
                      : `I2I Clubs • ${activeUser.school_code || 'Eco Club'}`
                    : 'I2I Clubs (Idea2Impact)'}
                </div>
                <div className="text-[11px] font-medium text-[#111010]/65 mt-0.5">
                  {isAuthenticated
                    ? activeUser.role === 'super_admin' || activeUser.role === 'admin'
                      ? 'Program Lead • National Project Office'
                      : activeUser.role === 'expert_admin' || activeUser.role === 'expert'
                      ? 'Adjudication & Criteria Evaluation'
                      : activeUser.role === 'teacher'
                      ? `Supervising Teacher • ${activeUser.school_name || 'Campus'}`
                      : `Gamified Eco Club • ${activeUser.school_name || '15 Schools'}`
                    : 'Sri Lanka • 15-School Index'}
                </div>
              </div>
            </div>
          </button>

          {/* Right: Spacious Horizontal Navigation Tabs */}
          {navItems.length > 0 && (
            <nav
              aria-label="Primary Navigation"
              className="hidden lg:flex items-center gap-2"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`px-4 py-2 rounded-full text-xs sm:text-[13px] font-semibold flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#005FA3] text-[#9CF2F2]'
                        : 'text-[#111010]/80 hover:bg-[#9CF2F2]/60 hover:text-[#005FA3]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                    {item.count !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                          isActive
                            ? 'bg-[#9CF2F2] text-[#005FA3]'
                            : 'bg-[#FFFFFF] text-[#005FA3]'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* Mobile / Tablet Navigation Strip */}
        {navItems.length > 0 && (
          <div className="lg:hidden border-t border-[#111010]/10 px-4 py-2 flex items-center gap-2 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabClick(item.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-[#005FA3] text-[#9CF2F2]'
                      : 'bg-[#FFFFFF] text-[#111010]/80 border border-[#111010]/15'
                  }`}
                >
                  {item.label}
                  {item.count !== undefined ? ` (${item.count})` : ''}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ====================================================================
       * Main Editorial Page Container (hai.stanford.edu/ai-index Grid)
       * ==================================================================== */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-8 pt-8 sm:pt-10 pb-16 space-y-8">

        {/* Stanford HAI AI Index Editorial PageHeader */}
        <section className="pb-8 border-b border-[#111010]/15">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#005FA3]">
              {currentMeta.eyebrow}
            </span>
            {currentMeta.badge !== undefined && (
              <span className="hai-cyan-pill text-xs font-bold">
                {currentMeta.badge}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-7">
              <h1 className="text-3xl sm:text-5xl font-semibold tracking-[-0.035em] leading-[1.04] text-[#111010] font-[var(--font-jakarta)]">
                {currentMeta.title}
              </h1>
            </div>
            <div className="lg:col-span-5">
              <p className="text-sm sm:text-base text-[#111010]/75 leading-relaxed">
                {currentMeta.subtitle}
              </p>
            </div>
          </div>
        </section>

        {/* Active View Content */}
        {activeTab === 'leaderboard' && (
          <LeaderboardView
            leaderboard={snapshot.leaderboard}
            config={snapshot.gamificationConfig}
            activeSchoolId={activeUser.school_id}
            onSelectClubProfile={(clubId) => {
              setSelectedClubId(clubId);
              setActiveTab('clubs');
            }}
            onOpenWhatsAppWorkbench={() => setActiveTab('student_gamified')}
            onOpenVerification={() => setActiveTab('verification')}
          />
        )}

        {activeTab === 'student_gamified' && (
          <StudentGamifiedDashboardView
            activeUser={activeUser}
            allUsers={snapshot.users}
            schools={snapshot.schools}
            clubs={snapshot.clubs}
            impactLogs={snapshot.impactLogs}
            leaderboard={snapshot.leaderboard}
            config={snapshot.gamificationConfig}
            onSwitchUser={(uid) => handleSwitchUser(uid, 'student_gamified')}
            onRefreshSnapshot={setSnapshot}
          />
        )}

        {activeTab === 'clubs' && (
          <ClubProfilesView
            clubs={snapshot.clubs}
            impactLogs={snapshot.impactLogs}
            activeUser={activeUser}
            selectedClubId={
              activeUser.role === 'teacher' || activeUser.role === 'student'
                ? activeUser.club_id || selectedClubId
                : selectedClubId
            }
            onSelectClub={(clubId) => {
              if (activeUser.role === 'teacher' || activeUser.role === 'student') return;
              setSelectedClubId(clubId);
            }}
          />
        )}

        {activeTab === 'verification' && (
          <VerificationEngineView
            activeUser={activeUser}
            users={snapshot.users}
            schools={snapshot.schools}
            impactLogs={snapshot.impactLogs}
            config={snapshot.gamificationConfig}
            leaderboard={snapshot.leaderboard}
            initialSubTab={
              activeUser.role === 'super_admin' || activeUser.role === 'admin'
                ? 'algorithm_config'
                : 'macro_scoring'
            }
            hideRoleSwitcher={true}
            onSwitchUser={setActiveUserId}
            onRefreshSnapshot={setSnapshot}
          />
        )}

        {activeTab === 'whatsapp_ingestion' && (
          <WhatsAppCloudWorkbench
            clubs={snapshot.clubs}
            schools={snapshot.schools}
            users={snapshot.users}
            impactLogs={snapshot.impactLogs}
            whatsappMessages={snapshot.whatsappMessages || snapshot.telegramMessages}
            activeUser={activeUser}
            isAdmin={activeUser.role === 'super_admin' || activeUser.role === 'admin'}
            isDev={false}
            initialRole={
              activeUser.role === 'expert_admin' || activeUser.role === 'expert'
                ? 'expert'
                : activeUser.role === 'teacher'
                ? 'teacher'
                : 'student'
            }
            initialClubId={
              activeUser.role === 'teacher' || activeUser.role === 'student'
                ? activeUser.club_id || 'club-01'
                : selectedClubId
            }
            onRefreshSnapshot={setSnapshot}
            onNavigateToVerification={() => setActiveTab('verification')}
          />
        )}

        {activeTab === 'health_risk' && (
          <HealthRiskDashboardView
            healthAlerts={snapshot.healthAlerts}
            auditLogs={snapshot.auditLogs}
            onInspectClub={(clubId) => {
              setSelectedClubId(clubId);
              setActiveTab('clubs');
            }}
            onNavigateToVerification={() => {
              setActiveTab('verification');
            }}
          />
        )}

        {activeTab === 'login_portal' && (
          <RoleLoginPortalView
            activeUser={activeUser}
            users={snapshot.users}
            leaderboard={snapshot.leaderboard}
            config={snapshot.gamificationConfig}
            onSelectUserAndNavigate={(uid, tab) => handleSwitchUser(uid, tab)}
          />
        )}

        {/* ====================================================================
         * Stanford HAI AI Index Style White Asymmetric Footer Card
         * ==================================================================== */}
        <footer className="hai-card p-6 sm:p-8 mt-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-4 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-[8px_8px_8px_2px] bg-[#005FA3] text-[#9CF2F2] flex items-center justify-center">
                  <Recycle className="w-4 h-4" />
                </div>
                <span className="font-bold text-base text-[#111010]">
                  I2I Clubs (Idea2Impact) • GIZ Sri Lanka Pilot
                </span>
              </div>
              <p className="text-xs text-[#111010]/70 leading-relaxed">
                4-Category Role-Based Circular Enterprise Platform spanning 15 Sri Lankan schools.
              </p>
            </div>

            <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-4 gap-3.5 text-xs">
              <div className="hai-chrome-box p-3.5">
                <div className="font-bold text-[#005FA3] uppercase tracking-wider text-[10px]">
                  1. Super Admin (GIZ)
                </div>
                <p className="text-[#111010]/80 mt-1">
                  National program governance, risk alerts, audit ledger &amp; scoring weights.
                </p>
              </div>
              <div className="hai-chrome-box p-3.5">
                <div className="font-bold text-[#005FA3] uppercase tracking-wider text-[10px]">
                  2. Expert Panel
                </div>
                <p className="text-[#111010]/80 mt-1">
                  Scores Macro sales (&gt; Rs. 15,000) across 6 criteria &amp; runs 10% audits.
                </p>
              </div>
              <div className="hai-chrome-box p-3.5">
                <div className="font-bold text-[#005FA3] uppercase tracking-wider text-[10px]">
                  3. School Teachers (15)
                </div>
                <p className="text-[#111010]/80 mt-1">
                  1 teacher login per school to verify on-campus logs up to Rs. 15,000.
                </p>
              </div>
              <div className="hai-chrome-box p-3.5">
                <div className="font-bold text-[#005FA3] uppercase tracking-wider text-[10px]">
                  4. Student Clubs (15)
                </div>
                <p className="text-[#111010]/80 mt-1">
                  15 single-user school logins with XP level bars, 6 quests &amp; WhatsApp activity logging.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Authentication & Dummy Profile Login Prompt Modal */}
      <AuthLoginPromptModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        users={snapshot.users}
        activeUser={isAuthenticated ? activeUser : null}
        onSelectUser={handleModalSelectUser}
        promptReason={loginPromptReason}
      />
    </div>
  );
}
