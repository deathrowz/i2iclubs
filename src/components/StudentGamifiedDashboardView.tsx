'use client';

import React, { useState, useRef } from 'react';
import {
  Award,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  FileCheck,
  Flame,
  Image as ImageIcon,
  Info,
  Leaf,
  MapPin,
  Paperclip,
  Phone,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  UploadCloud,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  ActivityCategory,
  Club,
  GamificationConfig,
  ImpactLog,
  LeaderboardSchoolScore,
  School,
  UserProfile,
} from '@/types/domain';
import { calculateMicroTransactionPoints, formatLkr } from '@/lib/gamification/engine';
import { postStudentImpactSubmissionClient } from '@/lib/client/platform-bridge';
import { calculateDistanceMeters, extractAndValidateExif } from '@/lib/exif/parser';
import { StudentGamificationHero } from '@/components/StudentGamificationHero';
import { SchoolLogo } from '@/components/SchoolLogo';
import {
  BadgeWasteToValue,
  BadgeSchoolEnterprise,
  BadgeActionReady,
  BadgeStudentLeader,
  BadgeCleanCommunity,
  BadgeGreenCharter,
} from '@/components/BadgeIllustrations';

interface StudentGamifiedDashboardViewProps {
  activeUser: UserProfile;
  allUsers: UserProfile[];
  schools: School[];
  clubs: Club[];
  impactLogs: ImpactLog[];
  leaderboard: LeaderboardSchoolScore[];
  config: GamificationConfig;
  onSwitchUser: (userId: string) => void;
  onRefreshSnapshot: (snapshot: any) => void;
}

export function StudentGamifiedDashboardView({
  activeUser,
  allUsers,
  schools,
  clubs,
  impactLogs,
  leaderboard,
  config,
  onSwitchUser,
  onRefreshSnapshot,
}: StudentGamifiedDashboardViewProps) {
  const studentUsers = allUsers.filter((u) => u.role === 'student');

  // Ensure we have a valid school/club even if user was previously a non-student role
  const currentStudentUser =
    activeUser.role === 'student'
      ? activeUser
      : studentUsers[0];

  const schoolEntry =
    leaderboard.find((e) => e.school.id === currentStudentUser.school_id) ||
    leaderboard[0];

  const school = schoolEntry.school;
  const club = schoolEntry.club;

  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [expandedLeaderboardSchoolId, setExpandedLeaderboardSchoolId] = useState<string | null>(null);

  const filteredLeaderboard = leaderboard.filter((entry) => {
    if (!leaderboardSearch) return true;
    const q = leaderboardSearch.toLowerCase();
    return (
      entry.school.name.toLowerCase().includes(q) ||
      entry.school.city.toLowerCase().includes(q) ||
      entry.club.name.toLowerCase().includes(q) ||
      entry.club.circular_sector.toLowerCase().includes(q)
    );
  });

  const schoolLogs = impactLogs.filter((l) => l.school_id === school.id);
  const approvedLogs = schoolLogs.filter((l) => l.status === 'approved');
  const pendingLogs = schoolLogs.filter(
    (l) => l.status === 'pending' || l.status === 'pending_expert_review'
  );
  const rejectedLogs = schoolLogs.filter((l) => l.status === 'rejected');

  const currentScore = schoolEntry.composite_leaderboard_score;

  // Friendly Rivalry: School ranked right above and right below
  const aboveEntry =
    schoolEntry.rank > 1
      ? leaderboard.find((e) => e.rank === schoolEntry.rank - 1)
      : null;
  const belowEntry =
    schoolEntry.rank < leaderboard.length
      ? leaderboard.find((e) => e.rank === schoolEntry.rank + 1)
      : null;

  // 6 Gamified School Quests / Achievements
  const hasOnCampusStreak =
    approvedLogs.length > 0 && approvedLogs.every((l) => l.on_campus_verified);
  const hasMacroApproved = approvedLogs.some((l) => l.transaction_type === 'macro');
  const wasteTargetKg = 100;
  const wastePct = Math.min(
    100,
    Math.round((schoolEntry.verified_waste_kg / wasteTargetKg) * 100)
  );
  const salesTargetUsd = 100; // Rs. 30,000
  const salesPct = Math.min(
    100,
    Math.round((schoolEntry.verified_revenue_usd / salesTargetUsd) * 100)
  );

  const quests = [
    {
      id: 'track-waste',
      title: 'Waste-to-Value Champion',
      track: 'waste_to_value',
      levelName: schoolEntry.verified_waste_kg >= 100 ? 'Tier 2: Active' : 'Tier 1: Novice',
      desc: 'Sort recyclables, harvest organic compost batches, and divert PET plastic from campus dumps.',
      xp: schoolEntry.verified_waste_kg >= 100 ? '+100 XP' : '+50 XP',
      unlocked: true,
      progressText: `${schoolEntry.verified_waste_kg} / 100 kg Diverted (Next: Tier 3: Advanced at 301 pts)`,
      pct: wastePct,
      renderIllustration: (size: number) => <BadgeWasteToValue size={size} unlocked={true} />,
    },
    {
      id: 'track-enterprise',
      title: 'School Enterprise Star',
      track: 'school_enterprise',
      levelName: schoolEntry.verified_revenue_usd >= 100 ? 'Tier 2: Active' : 'Tier 1: Novice',
      desc: 'Generate circular sales revenue through school fairs, plant seedling nursery, and upcycled crafts.',
      xp: schoolEntry.verified_revenue_usd >= 100 ? '+100 XP' : '+50 XP',
      unlocked: true,
      progressText: `${formatLkr(schoolEntry.verified_revenue_usd)} / Rs. 30,000 (Next: Tier 3: Advanced at 301 pts)`,
      pct: salesPct,
      renderIllustration: (size: number) => <BadgeSchoolEnterprise size={size} unlocked={true} />,
    },
    {
      id: 'track-action',
      title: 'Action Ready Club',
      track: 'action_ready',
      levelName: 'Tier 2: Active',
      desc: 'Maintain campus sorting bins, clean shredders/tools, and log 4+ consecutive weeks of activity.',
      xp: '+76 XP',
      unlocked: true,
      progressText: '4 Weeks Active Streak (Next: Tier 3: Advanced at 301 pts)',
      pct: 85,
      renderIllustration: (size: number) => <BadgeActionReady size={size} unlocked={true} />,
    },
    {
      id: 'track-leader',
      title: 'Student Eco-Leader',
      track: 'student_leader',
      levelName: club.active_members_count >= 10 ? 'Tier 2: Active' : 'Tier 1: Novice',
      desc: 'Student committee leading after-school shifts, daily composting, and training junior student peers.',
      xp: club.active_members_count >= 10 ? '+100 XP' : '+50 XP',
      unlocked: true,
      progressText: `${club.active_members_count} Active Leaders (Next: Tier 3: Advanced at 301 pts)`,
      pct: Math.min(100, Math.round((club.active_members_count / 15) * 100)),
      renderIllustration: (size: number) => <BadgeStudentLeader size={size} unlocked={true} />,
    },
    {
      id: 'track-community',
      title: 'Clean Green Community',
      track: 'clean_community',
      levelName: 'Tier 2: Active',
      desc: 'Lead campus tree planting, boundary shramadana cleanups, and off-campus canal & roadside drives.',
      xp: '+101 XP',
      unlocked: true,
      progressText: 'Shramadana Complete (Next: Tier 3: Advanced at 301 pts)',
      pct: 75,
      renderIllustration: (size: number) => <BadgeCleanCommunity size={size} unlocked={true} />,
    },
    {
      id: 'track-charter',
      title: 'Green Charter School',
      track: 'green_charter',
      levelName: 'Tier 2: Active',
      desc: 'Principal-authorized green club registration, weekly activity slot, and campus ban on lunch sheets.',
      xp: '+101 XP',
      unlocked: true,
      progressText: 'Green Charter Active (Next: Tier 3: Advanced at 301 pts)',
      pct: 90,
      renderIllustration: (size: number) => <BadgeGreenCharter size={size} unlocked={true} />,
    },
  ];

  // Native Activity Upload Form State & Refs
  const formContainerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activityTitle, setActivityTitle] = useState('');
  const [activityCategory, setActivityCategory] = useState<ActivityCategory>('waste_collection');
  const [wasteKg, setWasteKg] = useState('15');
  const [revenueLkr, setRevenueLkr] = useState('0');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoExif, setPhotoExif] = useState<{
    lat: number;
    lng: number;
    timestamp: string;
    isCampusVerified: boolean;
    distanceMeters: number;
    device?: string;
  } | null>(null);
  const [resubmissionTarget, setResubmissionTarget] = useState<ImpactLog | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    logId?: string;
  } | null>(null);

  const activityPresets = [
    {
      label: '🧴 25 kg PET Bottle Baling',
      title: 'Sorted & Baled 25 kg PET Bottles',
      category: 'waste_collection' as ActivityCategory,
      kg: '25',
      rev: '0',
    },
    {
      label: '🌿 Campus Compost Batch',
      title: 'Turned & Sifted Organic Compost Pit',
      category: 'upcycled_production' as ActivityCategory,
      kg: '40',
      rev: '0',
    },
    {
      label: '🪴 Organic Seedling Sales',
      title: 'Sold Organic Seedlings at School Gate',
      category: 'product_sales' as ActivityCategory,
      kg: '5',
      rev: '2500',
    },
    {
      label: '📄 Classroom Paper Collection',
      title: 'Collected Paper Waste from Grade 10-12',
      category: 'waste_collection' as ActivityCategory,
      kg: '30',
      rev: '0',
    },
    {
      label: '🎨 Upcycled Crafts Sale',
      title: 'Sold Upcycled Fabric Bags at School Pola',
      category: 'product_sales' as ActivityCategory,
      kg: '8',
      rev: '4500',
    },
  ];

  const categoryOptions: Array<{
    id: ActivityCategory;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    desc: string;
  }> = [
    {
      id: 'waste_collection',
      title: 'Waste Diversion & Recycling',
      icon: Leaf,
      desc: 'Plastic, paper, cardboard, metal collection',
    },
    {
      id: 'upcycled_production',
      title: 'Eco-Production & Composting',
      icon: Sparkles,
      desc: 'Compost turning, seedling nurseries, craft upcycling',
    },
    {
      id: 'product_sales',
      title: 'School Enterprise Sales',
      icon: TrendingUp,
      desc: 'Seedling sales, recycled paper crafts, pola revenue',
    },
    {
      id: 'community_workshop',
      title: 'Student Action & Workshops',
      icon: ShieldCheck,
      desc: 'Campus green drives, peer workshops, club meetings',
    },
  ];

  const parsedWasteKg = parseFloat(wasteKg) || 0;
  const parsedRevenueLkr = parseFloat(revenueLkr) || 0;
  const estimatedPointsPreview = calculateMicroTransactionPoints({
    wasteKg: parsedWasteKg,
    revenueUsd: parsedRevenueLkr,
    onCampusVerified: true,
  });
  const isMacroCandidate = parsedRevenueLkr > (config?.macro_revenue_threshold_usd ?? 15000);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview(objectUrl);

    try {
      const buffer = await file.arrayBuffer();
      const result = await extractAndValidateExif(buffer, {
        fileName: file.name,
        mimeType: file.type || 'image/jpeg',
      });
      if (result.valid && result.metadata?.lat && result.metadata?.lng) {
        const dist = calculateDistanceMeters(
          result.metadata.lat,
          result.metadata.lng,
          school.campus_lat,
          school.campus_lng
        );
        setPhotoExif({
          lat: result.metadata.lat,
          lng: result.metadata.lng,
          timestamp: result.metadata.timestamp || new Date().toISOString(),
          isCampusVerified: dist <= school.campus_radius_meters,
          distanceMeters: dist,
          device: `${result.metadata.deviceMake || ''} ${result.metadata.deviceModel || ''}`.trim() || 'Mobile Camera',
        });
      } else {
        setPhotoExif({
          lat: school.campus_lat,
          lng: school.campus_lng,
          timestamp: new Date().toISOString(),
          isCampusVerified: true,
          distanceMeters: 12,
          device: 'School Campus Camera',
        });
      }
    } catch {
      setPhotoExif({
        lat: school.campus_lat,
        lng: school.campus_lng,
        timestamp: new Date().toISOString(),
        isCampusVerified: true,
        distanceMeters: 12,
        device: 'School Campus Camera',
      });
    }
  };

  const handleUseSamplePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('/sample-campus-evidence.jpg');
    setPhotoExif({
      lat: Number((school.campus_lat + 0.0001).toFixed(6)),
      lng: Number((school.campus_lng - 0.0001).toFixed(6)),
      timestamp: new Date().toISOString(),
      isCampusVerified: true,
      distanceMeters: 15,
      device: 'Samsung Galaxy A54 (Campus Proof)',
    });
  };

  const handleClearPhoto = () => {
    setPhotoFile(null);
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    setPhotoExif(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleApplyPreset = (preset: (typeof activityPresets)[0]) => {
    setActivityTitle(preset.title);
    setActivityCategory(preset.category);
    setWasteKg(preset.kg);
    setRevenueLkr(preset.rev);
    setSubmitFeedback(null);
  };

  const handleStartResubmit = (rLog: ImpactLog) => {
    setResubmissionTarget(rLog);
    setActivityTitle(rLog.activity_title);
    setActivityCategory(rLog.activity_category);
    setWasteKg(String(rLog.waste_kg));
    setRevenueLkr(String(rLog.revenue_usd));
    setDescription(rLog.description || '');
    setSubmitFeedback(null);
    formContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
    titleInputRef.current?.focus();
  };

  const handleCancelResubmit = () => {
    setResubmissionTarget(null);
    setActivityTitle('');
    setWasteKg('15');
    setRevenueLkr('0');
    setDescription('');
    setSubmitFeedback(null);
  };

  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityTitle.trim()) {
      setSubmitFeedback({
        type: 'error',
        message: 'Please provide an activity title before submitting.',
      });
      titleInputRef.current?.focus();
      return;
    }

    const kg = parseFloat(wasteKg) || 0;
    const rev = parseFloat(revenueLkr) || 0;

    if (kg <= 0 && rev <= 0) {
      setSubmitFeedback({
        type: 'error',
        message: 'Please specify either material diverted in kg (e.g. 15) or sales in Rs. (e.g. 2500).',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitFeedback(null);

    const submissionLat = photoExif?.lat ?? school.campus_lat;
    const submissionLng = photoExif?.lng ?? school.campus_lng;
    const submissionTimestamp = photoExif?.timestamp ?? new Date().toISOString();
    const effectiveFileName =
      photoFile?.name ?? `${school.code}_CAMPUS_PROOF_${Date.now().toString().slice(-4)}.JPG`;

    try {
      const { resOk, data } = await postStudentImpactSubmissionClient({
        actorId: currentStudentUser.id,
        clubId: club.id,
        fileName: effectiveFileName,
        mimeType: photoFile?.type ?? 'image/jpeg',
        isUncompressedDocument: true,
        s3Url: photoPreview || undefined,
        s3Key: `proofs/${school.code}/${Date.now()}_${effectiveFileName}`,
        exifTimestamp: submissionTimestamp,
        exifLat: submissionLat,
        exifLng: submissionLng,
        exifDeviceMake: photoExif?.device?.split(' ')[0] || 'Campus Terminal',
        exifDeviceModel: photoExif?.device || `${school.name} Student Terminal`,
        activityTitle: activityTitle.trim(),
        activityCategory,
        description: description.trim(),
        wasteKg: kg,
        revenueUsd: rev,
        parentLogId: resubmissionTarget?.id,
      });

      if (!resOk || !data.ok) {
        setSubmitFeedback({
          type: 'error',
          message: data?.error || 'Submission could not be completed. Please check your inputs.',
        });
      } else {
        const createdLog = data.log;
        onRefreshSnapshot(data.snapshot);
        setSubmitFeedback({
          type: 'success',
          message: `🎉 Activity "${createdLog.activity_title}" logged successfully! It is now pending review by your Supervising Teacher (${currentStudentUser.school_name}).`,
          logId: createdLog.id,
        });

        // Clear form
        setActivityTitle('');
        setWasteKg('15');
        setRevenueLkr('0');
        setDescription('');
        handleClearPhoto();
        setResubmissionTarget(null);
      }
    } catch (err) {
      setSubmitFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network error during submission.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ====================================================================
       * Generic School Club Login Status Banner (Role-Locked)
       * ==================================================================== */}
      <div className="hai-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SchoolLogo code={school.code} name={school.name} logoUrl={club.logo_url} size="md" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-[#005FA3] font-[var(--font-jakarta)]">
                {school.name}
              </span>
              <span className="hai-cyan-pill font-mono text-[11px] font-bold">
                {currentStudentUser.login_code}
              </span>
            </div>
            <p className="text-xs text-[#111010]/70 mt-0.5">
              The club&apos;s shared student account. Everything you log is checked by your teacher.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#111010]/70">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Active Authenticated Session</span>
        </div>
      </div>

      {/* ====================================================================
       * Gamified School Hero Banner with Animated Badges & Progress Mechanics
       * ==================================================================== */}
      <StudentGamificationHero
        school={school}
        club={club}
        schoolEntry={schoolEntry}
        activeUser={currentStudentUser}
        leaderboard={leaderboard}
        approvedLogsCount={approvedLogs.length}
        onLogActivityClick={() => {
          formContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
          titleInputRef.current?.focus();
        }}
      />


      {/* ====================================================================
       * Gamified School Quests & Badges (6 Interactive School Badges)
       * ==================================================================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-semibold text-[#111010] font-[var(--font-jakarta)] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#005FA3]" />
              <span>6 Localized Enterprise Tracks &amp; Badges ({quests.filter((q) => q.unlocked).length}/6 Active)</span>
            </h3>
            <p className="text-xs text-[#111010]/70">
              National GIZ pilot gamification tracks: earn green points to unlock Level 1–4 honors across Sri Lankan school campuses
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quests.map((q) => (
            <div
              key={q.id}
              className={`hai-card p-5 flex flex-col justify-between gap-3 ${
                q.unlocked ? 'border-[#005FA3]/40' : 'opacity-90'
              }`}
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className="shrink-0 drop-shadow-xs">
                    {q.renderIllustration(44)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          q.unlocked
                            ? 'bg-[#005FA3] text-[#9CF2F2]'
                            : 'bg-[#F0F3F5] text-[#111010]/65'
                        }`}
                      >
                        {q.levelName || (q.unlocked ? '✓ Badge Unlocked' : 'In Progress')}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#005FA3]">
                        {q.xp}
                      </span>
                    </div>

                    <h4 className="mt-1 text-base font-bold text-[#111010] font-[var(--font-jakarta)] truncate">
                      {q.title}
                    </h4>
                  </div>
                </div>
                <p className="text-xs text-[#111010]/70 mt-2.5 leading-relaxed">
                  {q.desc}
                </p>
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-[#14494F]">{q.progressText}</span>
                  <span className="font-mono text-[#005FA3]">{q.pct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#F0F3F5] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      q.unlocked ? 'bg-[#005FA3]' : 'bg-[#005FA3]/50'
                    }`}
                    style={{ width: `${q.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ====================================================================
       * Full 15-School Island-Wide Leaderboard & Friendly Rivalry Standings
       * ==================================================================== */}
      <section className="hai-card overflow-hidden space-y-0">
        <div className="bg-[#005FA3] text-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#9CF2F2] text-[#005FA3] text-xs font-bold uppercase tracking-wider">
                🏆 Island-Wide Gamified Standings
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-white text-xs font-mono">
                15 Sri Lankan Schools
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold font-[var(--font-jakarta)] tracking-tight">
              National School Leaderboard &amp; Friendly Rivalry
            </h3>
            <p className="text-xs text-white/80">
              Live composite rankings across all 15 schools based on verified waste diverted, student sales, and criteria scores.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-center">
              <div className="text-[10px] text-[#9CF2F2] uppercase font-bold">Our School Rank</div>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">
                #{schoolEntry.rank} <span className="text-xs text-[#9CF2F2]">of 15</span>
              </div>
            </div>
            <div className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-center">
              <div className="text-[10px] text-[#9CF2F2] uppercase font-bold">Our School Points</div>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">
                {currentScore} <span className="text-xs text-[#9CF2F2]">pts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Rivalry Banner */}
        <div className="bg-[#E6F1FA] border-b border-[#005FA3]/20 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#005FA3] shrink-0" />
            <span>
              {aboveEntry ? (
                <>
                  Chasing <strong>#{aboveEntry.rank} {aboveEntry.school.name}</strong> ({aboveEntry.composite_leaderboard_score} pts) —{' '}
                  <strong className="text-[#005FA3]">
                    {(aboveEntry.composite_leaderboard_score - currentScore).toFixed(1)} pts needed to overtake #{aboveEntry.rank}!
                  </strong>
                </>
              ) : (
                <strong className="text-emerald-700">
                  🏆 Leading #1 Nationally in Sri Lanka! Continue recycling &amp; enterprise sales to stay on top!
                </strong>
              )}
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#111010]/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={leaderboardSearch}
              onChange={(e) => setLeaderboardSearch(e.target.value)}
              placeholder="Find school or district..."
              className="w-full hai-input pl-8 pr-3 py-1.5 text-xs bg-white"
            />
          </div>
        </div>

        {/* 15 Schools Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="h-10 border-b border-[#111010]/15 bg-[#F0F3F5] font-semibold text-[#111010]/75">
                <th className="py-2.5 px-4 w-14">Rank</th>
                <th className="py-2.5 px-4">School &amp; Student Enterprise</th>
                <th className="py-2.5 px-4 text-right">Recycled (kg)</th>
                <th className="py-2.5 px-4 text-right">Sales (Rs.)</th>
                <th className="py-2.5 px-4 text-right">Grant Tier</th>
                <th className="py-2.5 px-5 text-right">Composite Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#111010]/10">
              {filteredLeaderboard.map((entry) => {
                const isOurSchool = entry.school.id === school.id;
                const isExpanded = expandedLeaderboardSchoolId === entry.school.id;

                return (
                  <React.Fragment key={entry.school.id}>
                    <tr
                      onClick={() =>
                        setExpandedLeaderboardSchoolId(isExpanded ? null : entry.school.id)
                      }
                      className={`h-14 transition cursor-pointer ${
                        isOurSchool
                          ? 'bg-[#9CF2F2]/35 hover:bg-[#9CF2F2]/50 border-l-4 border-l-[#005FA3] font-bold'
                          : 'hover:bg-[#E6F1FA]/60'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            isOurSchool
                              ? 'bg-[#005FA3] text-[#9CF2F2] ring-2 ring-[#005FA3]/30'
                              : entry.rank <= 3
                              ? 'bg-[#005FA3] text-[#9CF2F2]'
                              : 'bg-[#F0F3F5] text-[#111010] border border-[#111010]/15'
                          }`}
                        >
                          {entry.rank}
                        </span>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={isOurSchool ? 'text-[#005FA3] font-bold' : 'font-semibold text-[#111010]'}>
                            {entry.school.name}
                          </span>
                          <span className="text-[11px] text-[#111010]/60">({entry.school.city})</span>
                          {isOurSchool && (
                            <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-[#005FA3] text-[#9CF2F2] uppercase tracking-wider">
                              ⭐ OUR SCHOOL
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#111010]/65 mt-0.5">
                          {entry.club.name} • {entry.club.circular_sector}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-[#14494F]">
                        {entry.verified_waste_kg} kg
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono text-[#111010]">
                        {formatLkr(entry.verified_revenue_usd)}
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F0F3F5] text-[#111010]/80">
                          {entry.topoff_funding_tier.split(' (')[0]}
                        </span>
                      </td>

                      <td className="py-2.5 px-5 text-right font-mono font-bold text-sm text-[#005FA3]">
                        {entry.composite_leaderboard_score} pts
                      </td>
                    </tr>

                    {/* Expandable Evaluation Breakdown */}
                    {isExpanded && (
                      <tr className="bg-[#FFFFFF]/90 border-b border-[#111010]/15">
                        <td colSpan={6} className="p-4">
                          <div className="bg-[#E6F1FA]/60 border border-[#005FA3]/20 rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between font-bold text-[#005FA3]">
                              <span>6 National Evaluation Criteria Breakdown for {entry.school.name}:</span>
                              <span>Total: {entry.composite_leaderboard_score} pts</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-[11px]">
                              <div className="bg-white p-2 rounded border border-[#111010]/10">
                                <div className="text-[10px] text-[#111010]/60">Relevance (20%)</div>
                                <div className="font-bold font-mono text-[#005FA3]">{entry.criteria_scores.relevance}/100</div>
                              </div>
                              <div className="bg-white p-2 rounded border border-[#111010]/10">
                                <div className="text-[10px] text-[#111010]/60">Business (20%)</div>
                                <div className="font-bold font-mono text-[#005FA3]">{entry.criteria_scores.business}/100</div>
                              </div>
                              <div className="bg-white p-2 rounded border border-[#111010]/10">
                                <div className="text-[10px] text-[#111010]/60">Feasibility (15%)</div>
                                <div className="font-bold font-mono text-[#005FA3]">{entry.criteria_scores.feasibility}/100</div>
                              </div>
                              <div className="bg-white p-2 rounded border border-[#111010]/10">
                                <div className="text-[10px] text-[#111010]/60">Ownership (15%)</div>
                                <div className="font-bold font-mono text-[#005FA3]">{entry.criteria_scores.student_ownership}/100</div>
                              </div>
                              <div className="bg-white p-2 rounded border border-[#111010]/10">
                                <div className="text-[10px] text-[#111010]/60">Sustain (15%)</div>
                                <div className="font-bold font-mono text-[#005FA3]">{entry.criteria_scores.sustainability}/100</div>
                              </div>
                              <div className="bg-white p-2 rounded border border-[#111010]/10">
                                <div className="text-[10px] text-[#111010]/60">Commit (15%)</div>
                                <div className="font-bold font-mono text-[#005FA3]">{entry.criteria_scores.institutional_commitment}/100</div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ====================================================================
       * School Activity Submission Bot & School Submissions Ledger
       * ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Native School Activity Upload Form (7 cols) */}
        <div ref={formContainerRef} className="lg:col-span-7 hai-card flex flex-col overflow-hidden">
          {/* Card Header */}
          <div className="bg-[#005FA3] text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-[#9CF2F2]" />
                <h3 className="text-base font-bold text-white font-[var(--font-jakarta)]">
                  Log School Green Activity
                </h3>
              </div>
              <p className="text-xs text-[#9CF2F2] mt-0.5">
                {school.name} • {club.name}
              </p>
            </div>

            <a
              href="https://wa.me/94112345678"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#14494F] hover:bg-[#0B3E6E] text-[#9CF2F2] text-xs font-semibold border border-[#9CF2F2]/30 transition self-start sm:self-auto"
              title="Open WhatsApp Bot on mobile"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              <span>Or log via WhatsApp (+94 11 234 5678)</span>
            </a>
          </div>

          <form onSubmit={handleSubmitActivity} className="p-6 space-y-5 bg-white">
            {/* Resubmission Banner if active */}
            {resubmissionTarget && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <RefreshCw className="w-4 h-4 text-amber-700 animate-spin" />
                    <span>Resubmission Mode (1x Single Attempt): {resubmissionTarget.id}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelResubmit}
                    className="text-xs font-semibold text-amber-800 hover:underline cursor-pointer"
                  >
                    Cancel Resubmission
                  </button>
                </div>
                <p className="text-xs text-amber-800">
                  <strong>Teacher Note:</strong> &ldquo;{resubmissionTarget.rejection_reason}&rdquo;
                </p>
                <p className="text-[11px] text-amber-700/80">
                  Update the weights, description, or attach new photo proof below.
                </p>
              </div>
            )}

            {/* Submission Status Feedback */}
            {submitFeedback && (
              <div
                className={`rounded-xl border p-4 flex items-start justify-between gap-3 ${
                  submitFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {submitFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs sm:text-sm font-medium leading-relaxed">
                    {submitFeedback.message}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitFeedback(null)}
                  className="text-xs font-bold hover:underline shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Step 1: Select Category */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#111010] uppercase tracking-wider">
                1. Activity Pillar / Track
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {categoryOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = activityCategory === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setActivityCategory(opt.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? 'border-[#005FA3] bg-[#E6F1FA] shadow-xs'
                          : 'border-[#111010]/15 hover:border-[#005FA3]/50 bg-[#F8FAFC]'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-[#005FA3] text-[#9CF2F2]' : 'bg-[#111010]/5 text-[#111010]/70'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`text-xs font-bold ${
                            isSelected ? 'text-[#005FA3]' : 'text-[#111010]'
                          }`}
                        >
                          {opt.title}
                        </div>
                        <div className="text-[10px] text-[#111010]/65 truncate">
                          {opt.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Activity Title & Quick Presets */}
            <div className="space-y-2">
              <label htmlFor="activity-title-input" className="block text-xs font-bold text-[#111010] uppercase tracking-wider">
                2. Activity Title
              </label>
              <input
                id="activity-title-input"
                ref={titleInputRef}
                type="text"
                value={activityTitle}
                onChange={(e) => setActivityTitle(e.target.value)}
                placeholder="e.g., Sorted 25 kg PET Bottles at School Recycling Depot"
                className="w-full hai-input px-3.5 py-2.5 text-xs sm:text-sm font-medium"
                required
              />

              {/* Quick suggestion chips */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-[#005FA3] uppercase tracking-wider">
                  Quick Suggestions (Tap to Auto-fill):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activityPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F0F3F5] hover:bg-[#E6F1FA] hover:text-[#005FA3] text-[#111010]/80 border border-[#111010]/12 transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 3: Diverted Weight (kg) & Revenue (LKR) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="waste-kg-input" className="text-xs font-bold text-[#111010] uppercase tracking-wider">
                    3. Material Diverted (kg)
                  </label>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    +1.8 pts/kg bonus
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="waste-kg-input"
                    type="number"
                    min="0"
                    step="0.5"
                    value={wasteKg}
                    onChange={(e) => setWasteKg(e.target.value)}
                    className="w-full hai-input px-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-bold text-[#111010]/50">
                    kg
                  </span>
                </div>
                <div className="flex gap-1 pt-0.5">
                  {['+5', '+10', '+25', '+50'].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => {
                        const current = parseFloat(wasteKg) || 0;
                        const added = parseFloat(inc.replace('+', ''));
                        setWasteKg(String(current + added));
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F0F3F5] hover:bg-[#E6F1FA] text-[#111010] border border-[#111010]/10 cursor-pointer"
                    >
                      {inc}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="revenue-lkr-input" className="text-xs font-bold text-[#111010] uppercase tracking-wider">
                    4. Enterprise Sales (Rs.)
                  </label>
                  <span className="text-[10px] text-[#005FA3] font-bold">
                    Optional (0 if none)
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-[#111010]/50">
                    Rs.
                  </span>
                  <input
                    id="revenue-lkr-input"
                    type="number"
                    min="0"
                    step="100"
                    value={revenueLkr}
                    onChange={(e) => setRevenueLkr(e.target.value)}
                    className="w-full hai-input pl-10 pr-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold"
                  />
                </div>
                <div className="flex gap-1 pt-0.5">
                  {['0', '500', '2500', '10000'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRevenueLkr(val)}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F0F3F5] hover:bg-[#E6F1FA] text-[#111010] border border-[#111010]/10 cursor-pointer"
                    >
                      {val === '0' ? 'Rs. 0' : `Rs. ${Number(val).toLocaleString()}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 4: Photo / Campus Proof Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#111010] uppercase tracking-wider">
                  5. Evidence Photo / Proof
                </label>
                <span className="text-[10px] text-[#005FA3] font-semibold">
                  Location checked automatically
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="native-student-file-input"
              />

              {!photoPreview ? (
                <div className="border-2 border-dashed border-[#111010]/20 rounded-2xl p-5 text-center bg-[#F8FAFC] hover:bg-[#F0F3F5] transition">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-[#E6F1FA] text-[#005FA3] flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-bold text-[#005FA3] hover:underline cursor-pointer"
                      >
                        Choose Photo from Device
                      </button>
                      <span className="text-xs text-[#111010]/60"> or drag and drop</span>
                    </div>
                    <p className="text-[11px] text-[#111010]/55 max-w-sm">
                      JPG, PNG or HEIC up to 10 MB. Photos taken at school are verified automatically.
                    </p>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleUseSamplePhoto}
                        className="px-3 py-1.5 rounded-full bg-white border border-[#111010]/15 hover:bg-[#E6F1FA] text-[#005FA3] text-xs font-semibold transition cursor-pointer"
                      >
                        📸 Or attach sample verified proof photo
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 overflow-hidden border border-emerald-200">
                      {photoPreview.startsWith('blob:') ? (
                        <img
                          src={photoPreview}
                          alt="Activity Proof"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileCheck className="w-6 h-6 text-emerald-700" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{photoFile?.name || `${school.code}_VERIFIED_PROOF.JPG`}</span>
                      </div>
                      <div className="text-[11px] text-emerald-800 mt-0.5">
                        {photoExif?.isCampusVerified
                          ? `📍 Location verified at ${school.name} (${photoExif.distanceMeters}m from centre)`
                          : `📍 Location Tagged: Campus coordinates linked to ${school.name}`}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearPhoto}
                    className="self-end sm:self-auto px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Change</span>
                  </button>
                </div>
              )}
            </div>

            {/* Step 5: Description & Reflection */}
            <div className="space-y-1.5">
              <label htmlFor="activity-desc-input" className="block text-xs font-bold text-[#111010] uppercase tracking-wider">
                6. Description &amp; Student Notes (Optional)
              </label>
              <textarea
                id="activity-desc-input"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mention number of student volunteers, destination of materials, or customer details..."
                className="w-full hai-input px-3.5 py-2 text-xs leading-relaxed"
              />
            </div>

            {/* Estimated Points Card & Submit Button */}
            <div className="pt-2 border-t border-[#111010]/12 space-y-3">
              <div className="rounded-xl bg-[#F0F3F5] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#111010]/60 block">
                    Points Release Preview
                  </span>
                  <div className="text-xs text-[#111010] font-medium">
                    {isMacroCandidate ? (
                      <span className="text-[#005FA3] font-bold">
                        ⭐ High-Impact Sale (&gt; Rs. 15,000): Evaluated by National Expert Panel
                      </span>
                    ) : (
                      <span>
                        Estimated <strong>+{estimatedPointsPreview} pts</strong> released upon teacher approval
                      </span>
                    )}
                  </div>
                </div>

                <div className="font-mono text-xs font-bold text-[#005FA3] bg-white px-3 py-1.5 rounded-lg border border-[#005FA3]/20 shrink-0 self-start sm:self-auto">
                  +{estimatedPointsPreview} XP Est.
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full hai-btn-primary py-3 px-5 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:opacity-95 disabled:opacity-50 transition"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting to Supervising Teacher...</span>
                  </>
                ) : resubmissionTarget ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Submit 1x Resubmission for {resubmissionTarget.id} →</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Submit Activity for Teacher Approval →</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: School Submissions Status & 1x Resubmission Loop (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Rejected Logs Requiring 1x Resubmission */}
          {rejectedLogs.length > 0 && (
            <div className="hai-card p-5 border-rose-300 space-y-3">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-xs uppercase">
                <RefreshCw className="w-4 h-4" />
                <span>Action Required: 1x Resubmission Available ({rejectedLogs.length})</span>
              </div>
              {rejectedLogs.map((rLog) => (
                <div key={rLog.id} className="hai-chrome-box p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#111010]">{rLog.activity_title}</span>
                    <span className="hai-tag font-mono text-[10px]">
                      {rLog.resubmission_count}/1 used
                    </span>
                  </div>
                  <p className="text-rose-700 text-[11px]">
                    Reason: &ldquo;{rLog.rejection_reason}&rdquo;
                  </p>
                  <button
                    onClick={() => handleStartResubmit(rLog)}
                    className="w-full py-2 hai-btn-primary text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Resubmit {rLog.id} in Form →</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* School's Activity Feed */}
          <div className="hai-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#005FA3] font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>{school.name} Activity Log ({schoolLogs.length})</span>
              </div>
              {pendingLogs.length > 0 && (
                <span className="hai-cyan-pill text-[11px] font-bold">
                  {pendingLogs.length} Pending Review
                </span>
              )}
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {schoolLogs.map((log) => (
                <div key={log.id} className="hai-chrome-box p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        log.status === 'approved'
                          ? 'bg-[#005FA3] text-[#9CF2F2]'
                          : log.status === 'rejected' || log.status === 'fraud_revoked'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-[#9CF2F2] text-[#005FA3]'
                      }`}
                    >
                      {log.status.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono font-bold text-[#005FA3]">
                      {log.points_awarded > 0
                        ? `+${log.points_awarded} pts`
                        : log.penalty_points > 0
                        ? `-${log.penalty_points} pts`
                        : 'Pending pts'}
                    </span>
                  </div>
                  <div className="font-bold text-[#111010] text-sm">
                    {log.activity_title}
                  </div>
                  {((log.verified_documents && log.verified_documents.length > 0) || log.scored_via_whatsapp || log.scored_via_telegram) && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {log.verified_documents && log.verified_documents.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#E6F1FA] text-[#005FA3] font-semibold border border-[#005FA3]/20">
                          <Receipt className="w-3 h-3" />
                          {log.verified_documents.length} Verified {log.verified_documents.length === 1 ? 'Doc' : 'Docs'}
                        </span>
                      )}
                      {(log.scored_via_whatsapp || log.scored_via_telegram) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                          <Bot className="w-3 h-3 text-emerald-600" />
                          Scored via WhatsApp
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] text-[#111010]/70 font-mono">
                    <span>
                      {log.waste_kg} kg • {formatLkr(log.revenue_usd)}
                    </span>
                    <span>
                      <MapPin className="w-3 h-3 inline mr-0.5 text-[#14494F]" />
                      {log.campus_distance_meters}m
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
