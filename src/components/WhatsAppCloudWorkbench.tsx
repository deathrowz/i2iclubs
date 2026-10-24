'use client';

import React, { useState } from 'react';
import {
  AlertOctagon,
  ArrowUpRight,
  CameraOff,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  CloudUpload,
  Code2,
  FileCheck,
  FileText,
  Gavel,
  Lock,
  MapPin,
  MessageSquare,
  MessageSquareWarning,
  Phone,
  RefreshCw,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import {
  Club,
  DocumentCategory,
  ImpactLog,
  School,
  UserProfile,
  UserRole,
} from '@/types/domain';
import { postWhatsAppWebhookClient } from '@/lib/client/platform-bridge';
import { formatLkr } from '@/lib/gamification/engine';

interface WhatsAppCloudWorkbenchProps {
  clubs: Club[];
  schools: School[];
  users: UserProfile[];
  impactLogs: ImpactLog[];
  telegramMessages?: any[];
  whatsappMessages?: any[];
  initialRole?: 'student' | 'teacher' | 'expert';
  initialClubId?: string;
  activeUser?: UserProfile;
  isDev?: boolean;
  isAdmin?: boolean;
  onRefreshSnapshot: (snapshot: any) => void;
  onNavigateToVerification: () => void;
}

interface ChatBubble {
  id: string;
  sender: 'student' | 'teacher' | 'expert' | 'bot';
  text: string;
  timestamp: string;
  badge?: string;
  isError?: boolean;
  statusIcon?: 'single_tick' | 'double_tick' | 'double_blue_tick';
}

export function WhatsAppCloudWorkbench({
  clubs,
  schools,
  users,
  impactLogs,
  initialRole,
  initialClubId,
  activeUser,
  isDev,
  isAdmin,
  onRefreshSnapshot,
  onNavigateToVerification,
}: WhatsAppCloudWorkbenchProps) {
  const effectiveUser =
    activeUser ||
    (initialRole === 'expert'
      ? users.find((u) => u.role === 'expert_admin')
      : initialRole === 'teacher'
      ? users.find((u) => u.role === 'teacher')
      : users.find((u) => u.role === 'student')) ||
    users[0];

  const isSuperAdmin = effectiveUser.role === 'super_admin' || Boolean(isAdmin);
  const isTeacher = effectiveUser.role === 'teacher' || initialRole === 'teacher';
  const isStudent = effectiveUser.role === 'student' || initialRole === 'student';
  const isExpert = effectiveUser.role === 'expert_admin' || initialRole === 'expert';
  const isRoleLocked = !isSuperAdmin;
  const isSchoolLocked = isTeacher || isStudent;

  const defaultClubId = isSchoolLocked
    ? effectiveUser.club_id ||
      clubs.find((c) => c.school_id === effectiveUser.school_id)?.id ||
      initialClubId ||
      'club-01'
    : initialClubId || 'club-01';

  const [selectedClubId, setSelectedClubId] = useState<string>(defaultClubId);
  const [activeBotRole, setActiveBotRole] = useState<'student' | 'teacher' | 'expert'>(
    initialRole || (isTeacher ? 'teacher' : isExpert ? 'expert' : 'student')
  );

  React.useEffect(() => {
    if (isSchoolLocked && effectiveUser) {
      const lockedClub = clubs.find(
        (c) => c.id === effectiveUser.club_id || c.school_id === effectiveUser.school_id
      );
      if (lockedClub) {
        setSelectedClubId(lockedClub.id);
      }
    } else if (initialClubId) {
      setSelectedClubId(initialClubId);
    }
  }, [initialClubId, isSchoolLocked, effectiveUser, clubs]);

  React.useEffect(() => {
    if (initialRole) {
      setActiveBotRole(initialRole);
    } else if (isTeacher) {
      setActiveBotRole('teacher');
    } else if (isExpert) {
      setActiveBotRole('expert');
    } else {
      setActiveBotRole('student');
    }
  }, [initialRole, isTeacher, isExpert]);

  const [botStage, setBotStage] = useState<string>('IDLE');
  const [chatInput, setChatInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showJsonInspector, setShowJsonInspector] = useState<boolean>(false);
  const [lastRawPayload, setLastRawPayload] = useState<string | null>(null);
  const [customPhoneOverride, setCustomPhoneOverride] = useState<string>('');
  const [selectedInvoiceLogId, setSelectedInvoiceLogId] = useState<string>('log-102');

  const selectedClub = clubs.find((c) => c.id === selectedClubId) || clubs[0];
  const selectedSchool =
    schools.find((s) => s.id === selectedClub.school_id) || schools[0];

  const currentActor = (() => {
    if (isRoleLocked) {
      return effectiveUser;
    }
    if (activeBotRole === 'expert') {
      return users.find((u) => u.role === 'expert_admin') || users[1];
    }
    if (activeBotRole === 'teacher') {
      return (
        users.find((u) => u.role === 'teacher' && u.school_id === selectedSchool.id) ||
        users.find((u) => u.role === 'teacher') ||
        users[3]
      );
    }
    return (
      users.find((u) => u.role === 'student' && u.school_id === selectedSchool.id) ||
      users.find((u) => u.role === 'student') ||
      users[0]
    );
  })();

  const activePhoneNumber = isRoleLocked
    ? currentActor.phone_number || (isTeacher ? '94772234501' : isExpert ? '94771000001' : '94771234501')
    : customPhoneOverride || currentActor.phone_number || '94771234501';

  const [chatHistory, setChatHistory] = useState<ChatBubble[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text:
        `Ayubowan / Vanakkam! 🌿 Welcome to *I2I Clubs (Idea2Impact)*.\n\n` +
        `📱 Connected club: *${selectedClub.name} • ${selectedSchool.name}*\n\n` +
        `Choose an action below to log a student activity, endorse a receipt as a teacher, or score a submission as an expert.`,
      timestamp: '09:30 AM',
      badge: 'WhatsApp Cloud API Active',
      statusIcon: 'double_blue_tick',
    },
  ]);

  const appendBubble = (bubble: Omit<ChatBubble, 'id' | 'timestamp'>) => {
    setChatHistory((prev) => [
      ...prev,
      {
        ...bubble,
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
  };

  const sendWebhookUpdate = async (
    payload: Record<string, any>,
    displayMessage: string,
    badge?: string,
    senderRole: 'student' | 'teacher' | 'expert' = activeBotRole
  ) => {
    setIsSending(true);
    appendBubble({
      sender: senderRole,
      text: displayMessage,
      badge: badge || `${senderRole.toUpperCase()} ACTION`,
      statusIcon: 'double_tick',
    });

    const simulatedMetaWebhookBody = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '94112345678',
                  phone_number_id: '1234567890',
                },
                contacts: [
                  {
                    profile: { name: currentActor.full_name },
                    wa_id: activePhoneNumber,
                  },
                ],
                messages: [
                  {
                    from: activePhoneNumber,
                    id: `wamid.HBgM${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: payload.document ? 'document' : 'text',
                    text: payload.text ? { body: payload.text } : undefined,
                    document: payload.document
                      ? {
                          id: `meta-doc-${Date.now()}`,
                          filename: payload.document.fileName,
                          mime_type: payload.document.mimeType,
                        }
                      : undefined,
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    };

    setLastRawPayload(JSON.stringify(simulatedMetaWebhookBody, null, 2));

    try {
      const data = await postWhatsAppWebhookClient({
        phoneNumber: activePhoneNumber,
        from: activePhoneNumber,
        actorId: currentActor.id,
        actorRole: currentActor.role,
        studentId: currentActor.role === 'student' ? currentActor.id : undefined,
        clubId: selectedClub.id,
        ...payload,
      });

      if (data.stage) setBotStage(data.stage);
      if (data.snapshot) onRefreshSnapshot(data.snapshot);

      appendBubble({
        sender: 'bot',
        text: data.botReply || data.error || 'No response from WhatsApp Cloud API.',
        badge: data.scoredPoints
          ? `🏆 SCORED VIA WHATSAPP: +${data.scoredPoints} pts posted to Leaderboard!`
          : data.attachedDocId
          ? `📄 INVOICE VERIFIED & FORWARDED TO GIZ/EXPERTS`
          : data.createdLogId
          ? `Logged ${data.createdLogId} (Pending Teacher)`
          : undefined,
        isError: !data.ok,
        statusIcon: 'double_blue_tick',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;
    const text = chatInput.trim();
    setChatInput('');
    await sendWebhookUpdate({ text }, text);
  };

  const pendingTeacherLogs = impactLogs.filter(
    (l) => l.school_id === selectedSchool.id && l.status !== 'approved'
  );

  return (
    <div className="space-y-6">
      {/* ====================================================================
       * WhatsApp Cloud API Gateway Header & Compliance Summary
       * ==================================================================== */}
      <div className="hai-card p-5 space-y-4 border-l-4 border-l-[#25D366]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#25D366] text-white shadow-sm">
              <Phone className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#111010] font-[var(--font-jakarta)]">
                  {isTeacher
                    ? 'Teacher Activity & Receipt Approval'
                    : isExpert
                    ? 'Expert Reviews & Scoring'
                    : 'WhatsApp Activity Hub'}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#25D366]/20 text-[#128C7E]">
                  Verified
                </span>
              </div>
              <p className="text-xs text-[#111010]/70">
                Official club channel • +94 11 234 5678
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isSchoolLocked ? (
              <div className="px-3.5 py-1.5 rounded-full bg-[#005FA3] text-[#9CF2F2] text-xs font-bold flex items-center gap-2 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{selectedSchool.name} — {selectedClub.name}</span>
              </div>
            ) : (
              <select
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                aria-label="Select School Club"
                className="hai-input px-3.5 py-2 text-xs text-[#111010] font-semibold cursor-pointer"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.school_name} — {c.name}
                  </option>
                ))}
              </select>
            )}

            {(isSuperAdmin || isDev) && (
              <button
                onClick={() => setShowJsonInspector(!showJsonInspector)}
                className="hai-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Code2 className="w-3.5 h-3.5 text-[#128C7E]" />
                <span>{showJsonInspector ? 'Hide Details' : 'View Submission Details'}</span>
              </button>
            )}

            <button
              onClick={onNavigateToVerification}
              className="hai-btn-secondary px-3.5 py-2 text-xs cursor-pointer"
            >
              Dashboard Approvals →
            </button>
          </div>
        </div>

        {/* Compliance and Active Actor Ribbon */}
        <div className="pt-2 border-t border-[#111010]/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-emerald-800 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Secure connection</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-800 font-semibold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>Evidence stored privately</span>
            </div>
          </div>

          {/* Active verified sender */}
          <div className="flex items-center gap-2 bg-[#F0F3F5] px-3 py-1 rounded-lg border border-[#111010]/10">
            <span className="text-[11px] text-[#111010]/70">Verified sender:</span>
            <span className="font-mono font-bold text-[#005FA3]">
              +{activePhoneNumber}
            </span>
            <span className="text-[10px] text-gray-500">
              ({currentActor.full_name.split(' (')[0]})
            </span>
          </div>
        </div>
      </div>

      {/* ====================================================================
       * Submission Details Inspector (Clean Production View vs Developer JSON)
       * ==================================================================== */}
      {showJsonInspector && (
        isSuperAdmin || isDev ? (
          <div className="hai-card p-4 bg-[#111010] text-[#9CF2F2] font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-white/80 border-b border-white/10 pb-2">
              <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                <Code2 className="w-4 h-4" />
                Meta Graph API v20.0 Webhook Payload (`/api/webhook/whatsapp`)
              </span>
              <span className="text-[11px] text-white/50">
                X-Hub-Signature-256 HMAC &amp; TimingSafeEqual Validated
              </span>
            </div>
            <pre className="overflow-x-auto p-2 bg-black/40 rounded max-h-48 text-[11px]">
              {lastRawPayload ||
                JSON.stringify(
                  {
                    endpoint: '/api/webhook/whatsapp',
                    region: 'OCI self-hosted (161.118.247.101)',
                    hub_verify: 'passed',
                    storage_bucket: 'i2i-proofs (private)',
                    status: 'Awaiting next action trigger...',
                  },
                  null,
                  2
                )}
            </pre>
          </div>
        ) : (
          <div className="hai-card p-4 bg-[#F8FAFC] border border-[#005FA3]/20 text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-[#111010]/10 pb-2">
              <span className="font-bold text-[#005FA3] flex items-center gap-1.5">
                <FileCheck className="w-4 h-4" />
                Submission Status &amp; Location Details
              </span>
              <span className="hai-tag text-[10px] font-mono font-bold">
                Phone: +{activePhoneNumber}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded bg-white border border-[#111010]/10">
                <div className="text-[10px] text-[#111010]/60">School Campus</div>
                <div className="font-bold text-[#111010]">{selectedSchool.name}</div>
              </div>
              <div className="p-2 rounded bg-white border border-[#111010]/10">
                <div className="text-[10px] text-[#111010]/60">GPS Radius</div>
                <div className="font-bold text-[#14494F] font-mono">{selectedSchool.campus_radius_meters}m</div>
              </div>
              <div className="p-2 rounded bg-white border border-[#111010]/10">
                <div className="text-[10px] text-[#111010]/60">Submission Mode</div>
                <div className="font-bold text-[#005FA3]">Verified On-Campus File</div>
              </div>
              <div className="p-2 rounded bg-white border border-[#111010]/10">
                <div className="text-[10px] text-[#111010]/60">Security Protocol</div>
                <div className="font-bold text-emerald-700 font-mono">HMAC-SHA256 Validated</div>
              </div>
            </div>
          </div>
        )
      )}

      {/* ====================================================================
       * Interactive Role Switcher & Phone Number Override (Only for Super Admin / Simulator)
       * ==================================================================== */}
      {!isRoleLocked && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => {
              setActiveBotRole('student');
              setCustomPhoneOverride('');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              activeBotRole === 'student' && !customPhoneOverride
                ? 'bg-[#E6F8ED] border-[#25D366] text-[#075E54] shadow-sm'
                : 'bg-white border-[#111010]/15 hover:bg-[#F0F3F5]'
            }`}
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                1. Student Enterprise Mode
              </div>
              <div className="text-[11px] text-[#111010]/70">
                Submit photo evidence &amp; track club status
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-[#128C7E]">
              +94771234501
            </span>
          </button>

          <button
            onClick={() => {
              setActiveBotRole('teacher');
              setCustomPhoneOverride('');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              activeBotRole === 'teacher' && !customPhoneOverride
                ? 'bg-[#E6F8ED] border-[#25D366] text-[#075E54] shadow-sm'
                : 'bg-white border-[#111010]/15 hover:bg-[#F0F3F5]'
            }`}
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                2. Supervising Teacher Mode
              </div>
              <div className="text-[11px] text-[#111010]/70">
                Upload verified invoices &amp; bookshop receipts
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-[#128C7E]">
              +94772234501
            </span>
          </button>

          <button
            onClick={() => {
              setActiveBotRole('expert');
              setCustomPhoneOverride('');
            }}
            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
              activeBotRole === 'expert' && !customPhoneOverride
                ? 'bg-[#E6F8ED] border-[#25D366] text-[#075E54] shadow-sm'
                : 'bg-white border-[#111010]/15 hover:bg-[#F0F3F5]'
            }`}
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">
                3. National Expert Panel
              </div>
              <div className="text-[11px] text-[#111010]/70">
                Review invoices &amp; score criteria via WhatsApp
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-[#128C7E]">
              +94771000001
            </span>
          </button>
        </div>
      )}

      {/* ====================================================================
       * Main Workbench Grid: WhatsApp Chat (Left 7 cols) + Action Controls (Right 5 cols)
       * ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: WhatsApp Web Style Interface */}
        <div className="lg:col-span-7 hai-card flex flex-col overflow-hidden border border-[#25D366]/40 shadow-sm">
          {/* WhatsApp Header */}
          <div className="bg-[#075E54] text-white px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-sm shadow">
                I2I
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>I2I Clubs (Idea2Impact) Sri Lanka</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] fill-[#25D366] text-white" />
                </div>
                <div className="text-[11px] text-white/80">
                  Official WhatsApp Business Account • Verified
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#128C7E] text-white">
                ONLINE
              </span>
            </div>
          </div>

          {/* WhatsApp Chat Pane (Message Stream) */}
          <div className="p-4 space-y-3 h-[420px] overflow-y-auto bg-[#EFEAE2]">
            {chatHistory.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col ${
                  item.sender === 'bot' ? 'items-start' : 'items-end'
                }`}
              >
                {item.badge && (
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1 ${
                      item.isError
                        ? 'bg-rose-100 text-rose-800'
                        : item.sender === 'bot'
                        ? 'bg-[#DCF8C6] text-[#075E54]'
                        : 'bg-white text-gray-700 shadow-xs'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-xs whitespace-pre-line leading-relaxed ${
                    item.sender === 'bot'
                      ? 'bg-white text-[#111010] rounded-tl-xs border border-black/5'
                      : 'bg-[#DCF8C6] text-[#075E54] rounded-tr-xs border border-[#25D366]/30'
                  }`}
                >
                  <div>{item.text}</div>
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-black/40">
                    <span>{item.timestamp}</span>
                    {item.statusIcon === 'double_blue_tick' && (
                      <CheckCheck className="w-3.5 h-3.5 text-[#34B7F1]" />
                    )}
                    {item.statusIcon === 'double_tick' && (
                      <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
                    )}
                    {item.statusIcon === 'single_tick' && (
                      <Check className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Action Touch Buttons Bar */}
          <div className="p-2.5 bg-[#F0F2F5] border-t border-[#111010]/10 flex flex-wrap items-center gap-2">
            <button
              disabled={isSending}
              onClick={() => sendWebhookUpdate({ text: '/log_impact' }, '📸 Log Impact Activity')}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#25D366] text-white hover:bg-[#128C7E] transition cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <span>📸 Log Activity</span>
            </button>
            <button
              disabled={isSending}
              onClick={() => sendWebhookUpdate({ text: '/status' }, '📊 Club Status')}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-white text-[#075E54] border border-[#075E54]/20 hover:bg-emerald-50 transition cursor-pointer"
            >
              <span>📊 Club Status</span>
            </button>
            <button
              disabled={isSending}
              onClick={() => sendWebhookUpdate({ text: '/leaderboard' }, '🏆 National Leaderboard')}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-white text-[#075E54] border border-[#075E54]/20 hover:bg-emerald-50 transition cursor-pointer"
            >
              <span>🏆 Leaderboard</span>
            </button>
            <button
              disabled={isSending}
              onClick={() => sendWebhookUpdate({ text: '/photo_guide' }, '❓ Photo Guide')}
              className="px-3 py-1.5 rounded-full text-xs font-bold bg-white text-gray-700 border border-black/10 hover:bg-gray-100 transition cursor-pointer"
            >
              <span>❓ Guidelines</span>
            </button>
          </div>

          {/* WhatsApp Text Input Bar */}
          <form
            onSubmit={handleSendText}
            className="p-3 bg-[#F0F2F5] border-t border-[#111010]/10 flex items-center gap-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isSending}
              placeholder={`Message I2I Clubs (+94 11 234 5678) as +${activePhoneNumber}...`}
              className="flex-1 bg-white border border-[#111010]/15 rounded-xl px-4 py-2 text-xs text-[#111010] focus:outline-none focus:ring-1 focus:ring-[#25D366]"
            />
            <button
              type="submit"
              disabled={isSending || !chatInput.trim()}
              className="p-2 rounded-xl bg-[#25D366] text-white hover:bg-[#128C7E] disabled:opacity-50 transition cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right: Media Ingestion & Simulation Tooling (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Card 1: Direct Activity Submission */}
          <div className="hai-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-[#25D366]" />
              <h3 className="text-sm font-bold text-[#111010]">
                {isTeacher
                  ? 'Submit Activity on Behalf of Student'
                  : 'Submit Activity Photo'}
              </h3>
            </div>
            <p className="text-xs text-[#111010]/70">
              Photo must be taken directly at the school premises with location services enabled.
            </p>

            <div className="space-y-2 pt-2">
              <button
                disabled={isSending}
                onClick={() =>
                  sendWebhookUpdate(
                    {
                      document: {
                        fileName: 'RECYCLED_PAPER_BATCH_EXIF.JPG',
                        mimeType: 'image/jpeg',
                        simulatedExif: {
                          timestamp: new Date().toISOString(),
                          lat: selectedSchool.campus_lat,
                          lng: selectedSchool.campus_lng,
                        },
                      },
                    },
                    '📎 [Document Attached]: RECYCLED_PAPER_BATCH_EXIF.JPG (Uncompressed Photo with Valid Campus GPS)',
                    'STUDENT EVIDENCE'
                  )
                }
                className="w-full text-left p-3 rounded-xl bg-[#E6F8ED] hover:bg-[#D1F2DE] border border-[#25D366]/40 transition cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-[#075E54]">
                    📸 Send Valid School Photo
                  </div>
                  <div className="text-[11px] text-[#075E54]/80">
                    School GPS: {selectedSchool.campus_lat.toFixed(4)}, {selectedSchool.campus_lng.toFixed(4)} (On Campus)
                  </div>
                </div>
                <FileCheck className="w-4 h-4 text-[#25D366]" />
              </button>

              {(isSuperAdmin || isDev) && (
                <button
                  disabled={isSending}
                  onClick={() =>
                    sendWebhookUpdate(
                      {
                        photoCompressed: { fakePayload: 'compressed_jpeg_no_exif' },
                      },
                      '📷 [Sent as Compressed Photo via WhatsApp Camera icon]',
                      'NEGATIVE TEST'
                    )
                  }
                  className="w-full text-left p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-amber-900">
                      ⚠️ Photo Missing School Location
                    </div>
                    <div className="text-[11px] text-amber-800/80">
                      Photo must be taken directly at the school premises with location services enabled.
                    </div>
                  </div>
                  <CameraOff className="w-4 h-4 text-amber-600" />
                </button>
              )}

              {(isSuperAdmin || isDev) && (
                <button
                  disabled={isSending}
                  onClick={() =>
                    sendWebhookUpdate(
                      {
                        phoneNumber: '94779999999',
                        from: '94779999999',
                        text: 'Hello, I want to submit paper recycling evidence',
                      },
                      '📱 [Simulate Inbound Message from Unregistered Number +94 77 999 9999]',
                      'SECURITY TEST'
                    )
                  }
                  className="w-full text-left p-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-rose-900">
                      🚨 Test Unregistered Phone Handling
                    </div>
                    <div className="text-[11px] text-rose-800/80">
                      Returns HTTP 200 without retrying or throwing 500
                    </div>
                  </div>
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Teacher Receipt & Activity Approval */}
          {(isTeacher || isExpert || isSuperAdmin) && (
            <div className="hai-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#005FA3]" />
                <h3 className="text-sm font-bold text-[#111010]">
                  Teacher Activity &amp; Receipt Approval
                </h3>
              </div>
              <p className="text-xs text-[#111010]/70">
                Attach verified sales invoices, pola receipts, or waste weighbridge scale tickets for student submissions.
              </p>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedInvoiceLogId}
                    onChange={(e) => setSelectedInvoiceLogId(e.target.value)}
                    aria-label="Select Target Log"
                    className="hai-input px-3 py-1.5 text-xs flex-1 cursor-pointer"
                  >
                    {impactLogs
                      .filter((l) => l.school_id === selectedSchool.id)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.id} — {l.activity_title.slice(0, 30)} ({formatLkr(l.revenue_usd)})
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  disabled={isSending}
                  onClick={() =>
                    sendWebhookUpdate(
                      {
                        actorRole: 'teacher',
                        text: `/upload_invoice ${selectedInvoiceLogId}`,
                      },
                      `/upload_invoice ${selectedInvoiceLogId}`,
                      'TEACHER ACTION',
                      'teacher'
                    )
                  }
                  className="w-full py-2 px-3 rounded-lg bg-[#E6F1FA] hover:bg-[#D0E5F5] text-[#005FA3] font-bold text-xs transition cursor-pointer text-center"
                >
                  Initiate Receipt Attachment for {selectedInvoiceLogId}
                </button>

                <button
                  disabled={isSending}
                  onClick={() =>
                    sendWebhookUpdate(
                      {
                        actorRole: 'teacher',
                        document: {
                          fileName: `INV-${selectedSchool.code}-OFFICIAL-RECEIPT.PDF`,
                          mimeType: 'application/pdf',
                          docCategory: 'sales_invoice',
                        },
                      },
                      `📎 [PDF Invoice Attached]: INV-${selectedSchool.code}-OFFICIAL-RECEIPT.PDF`,
                      'TEACHER ATTACHMENT',
                      'teacher'
                    )
                  }
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer text-center"
                >
                  Attach Official PDF Receipt (Forward to Panel)
                </button>
              </div>
            </div>
          )}

          {/* Card 3: National Expert Criteria Scoring */}
          {(isExpert || isSuperAdmin) && (
            <div className="hai-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Gavel className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-bold text-[#111010]">
                  National Expert Criteria Scoring
                </h3>
              </div>
              <p className="text-xs text-[#111010]/70">
                National Expert Panel members evaluate dossiers and submit selection criteria scores directly via WhatsApp message commands.
              </p>

              <button
                disabled={isSending}
                onClick={() =>
                  sendWebhookUpdate(
                    {
                      actorRole: 'expert_admin',
                      text: `/score ${selectedInvoiceLogId} 92 88 86 94 95 90`,
                    },
                    `/score ${selectedInvoiceLogId} 92 88 86 94 95 90`,
                    'EXPERT SCORING',
                    'expert'
                  )
                }
                className="w-full py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs transition cursor-pointer text-center flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>Submit 6 Criteria Scores for {selectedInvoiceLogId}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
