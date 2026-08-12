import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  FileCheck,
  FileText,
  HardHat,
  Layers,
  Ruler,
  Shield,
  Upload,
  X,
} from 'lucide-react-native';
import { useKnowledgeEmbeddingFlow } from '../hooks/useKnowledgeEmbeddingFlow';

type Screen = 'welcome' | 'project-type' | 'add-documents' | 'processing';
type DocType = 'engineering' | 'flooring' | 'council' | 'other';

type ConstructionType = 'new-home' | 'renovation' | 'other' | null;

interface DocFile {
  id: string;
  name: string;
  size: string;
  type: DocType;
  status: 'ready' | 'uploading' | 'done';
}

const DOC_ICONS: Record<DocType, React.ReactNode> = {
  engineering: <Ruler size={16} color="#4f46e5" />,
  flooring: <Layers size={16} color="#4f46e5" />,
  council: <FileCheck size={16} color="#4f46e5" />,
  other: <FileText size={16} color="#64748b" />,
};

const DOC_LABELS: Record<DocType, string> = {
  engineering: 'Engineering Plan',
  flooring: 'Flooring Plan',
  council: 'Council Approval',
  other: 'Document',
};

const CONSTRUCTION_TYPES: Array<{ id: ConstructionType; label: string; description: string; icon: React.ReactNode }> = [
  {
    id: 'new-home',
    label: 'New home build',
    description: 'Building a brand-new home from the ground up',
    icon: <HardHat size={22} color="#0f172a" />,
  },
  {
    id: 'renovation',
    label: 'Renovation',
    description: 'Extending, modifying, or refurbishing an existing home',
    icon: <Ruler size={22} color="#0f172a" />,
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Granny flat, garage, pool, or another project type',
    icon: <Layers size={22} color="#0f172a" />,
  },
];

const SAMPLE_DOCS: Array<Omit<DocFile, 'status'>> = [
  { id: '1', name: 'Engineering_Plan_v3.pdf', size: '4.2 MB', type: 'engineering' },
  { id: '2', name: 'Council_Approval_2024.pdf', size: '1.8 MB', type: 'council' },
  { id: '3', name: 'Flooring_Layout_Final.pdf', size: '2.6 MB', type: 'flooring' },
];

const PROCESSING_STEPS = [
  'Reading document structure',
  'Identifying plan types',
  'Extracting measurements',
  'Cross-referencing approvals',
  'Building your project model',
];

function inferDocType(name: string): DocType {
  const lower = name.toLowerCase();
  if (lower.includes('engineer') || lower.includes('struct')) return 'engineering';
  if (lower.includes('floor') || lower.includes('layout')) return 'flooring';
  if (lower.includes('council') || lower.includes('permit') || lower.includes('approv')) return 'council';
  return 'other';
}

function WelcomeStep({
  address,
  setAddress,
  onStart,
}: {
  address: string;
  setAddress: (value: string) => void;
  onStart: () => void;
}) {
  return (
    <View style={styles.screenContainer}>
      <View style={styles.phoneShell}>
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>9:41</Text>
          <View style={styles.statusSignal} />
        </View>

        <View style={styles.heroArea}>
          <View style={styles.gridOverlay} />
          <View style={styles.heroIconWrap}>
            <View style={styles.heroIconCircle}>
              <HardHat size={36} color="#d7f1ff" />
            </View>
            <View style={styles.orbitOne}><FileText size={14} color="#d7f1ff" /></View>
            <View style={styles.orbitTwo}><Ruler size={12} color="#d7f1ff" /></View>
            <View style={styles.orbitThree}><Layers size={11} color="#d7f1ff" /></View>
          </View>
          <View style={styles.brandLabel}><Text style={styles.brandText}>Buildwise</Text></View>
        </View>

        <View style={styles.contentPanel}>
          <Text style={styles.heading}>
            Let&apos;s understand
            <Text style={styles.accentText}> your project.</Text>
          </Text>

          <Text style={styles.subheading}>
            We&apos;ll use your uploaded documents — engineering plans, council approvals, flooring layouts — to build a clear picture of your home and guide you through every step.
          </Text>

          <View style={styles.bulletList}>
            {[
              { icon: <Upload size={15} color="#475569" />, text: 'Upload your construction documents' },
              { icon: <FileCheck size={15} color="#475569" />, text: 'We analyse them automatically' },
              { icon: <HardHat size={15} color="#475569" />, text: 'Get guided insights for your project' },
            ].map((item, index) => (
              <View key={index} style={styles.bulletRow}>
                <View style={styles.bulletIcon}>{item.icon}</View>
                <Text style={styles.bulletText}>{item.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.ctaWrap}>
            <Text style={styles.labelText}>Property address</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="e.g. 12 Maple Street, Sydney NSW 2000"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />

            <Pressable
              accessibilityRole="button"
              onPress={onStart}
              disabled={address.trim().length === 0}
              style={[styles.primaryButton, address.trim().length === 0 && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryButtonText}>Get started</Text>
              <ArrowRight size={18} color="#ffffff" />
            </Pressable>

            <View style={styles.privacyRow}>
              <Shield size={13} color="#64748b" />
              <Text style={styles.privacyText}>Your documents stay on this device. Nothing is sent to the cloud.</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function ProjectTypeStep({
  selected,
  setSelected,
  onBack,
  onContinue,
}: {
  selected: ConstructionType;
  setSelected: (value: ConstructionType) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <View style={styles.screenContainer}>
      <View style={styles.phoneShell}>
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>9:41</Text>
          <View style={styles.statusSignal} />
        </View>

        <View style={styles.headerSection}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <ChevronLeft size={16} color="#dfe9ff" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.stepText}>Step 1 of 3</Text>
          <Text style={styles.headerTitle}>{`What type of
construction is this?`}</Text>
          <Text style={styles.headerSubtitle}>This helps us understand which documents to look for.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.optionsList}>
          {CONSTRUCTION_TYPES.map((type) => {
            const isSelected = selected === type.id;

            return (
              <Pressable
                key={String(type.id)}
                onPress={() => setSelected(type.id)}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              >
                <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>{type.icon}</View>
                <View style={styles.optionTextWrap}>
                  <Text style={styles.optionLabel}>{type.label}</Text>
                  <Text style={styles.optionDescription}>{type.description}</Text>
                </View>
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </Pressable>
            );
          })}

          <View style={styles.futureField}>
            <Text style={styles.futureText}>More fields coming soon…</Text>
          </View>
        </ScrollView>

        <View style={styles.footerArea}>
          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            disabled={!selected}
            style={[styles.primaryButton, !selected && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
            <ArrowRight size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function UploadDocumentsStep({
  docs,
  onAddDemoDoc,
  onRemoveDoc,
  onProcess,
}: {
  docs: DocFile[];
  onAddDemoDoc: (demo: Omit<DocFile, 'status'>) => void;
  onRemoveDoc: (id: string) => void;
  onProcess: () => void;
}) {
  return (
    <View style={styles.screenContainer}>
      <View style={styles.phoneShell}>
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>9:41</Text>
          <View style={styles.statusSignal} />
        </View>

        <View style={styles.headerSectionAlt}>
          <Text style={styles.stepText}>Step 2 of 3</Text>
          <Text style={styles.headerTitle}>Add your documents</Text>
          <Text style={styles.headerSubtitle}>Upload any construction documents you have for this project.</Text>
        </View>

        <ScrollView contentContainerStyle={styles.documentsList}>
          <View style={styles.dropZone}>
            <View style={styles.dropZoneIcon}><Upload size={22} color="#64748b" /></View>
            <Text style={styles.dropZoneTitle}>Tap to upload files</Text>
            <Text style={styles.dropZoneHint}>PDF, DWG, JPG · Up to 50 MB each</Text>
          </View>

          {docs.length === 0 && (
            <View style={styles.demoSection}>
              <Text style={styles.docSectionLabel}>Common document types</Text>
              {SAMPLE_DOCS.map((demo) => (
                <Pressable key={demo.id} onPress={() => onAddDemoDoc(demo)} style={styles.docRow}>
                  <View style={styles.docIcon}>{DOC_ICONS[demo.type]}</View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docName}>{demo.name}</Text>
                    <Text style={styles.docMeta}>{DOC_LABELS[demo.type]} · {demo.size}</Text>
                  </View>
                  <View style={styles.chevronWrap}><ArrowRight size={14} color="#64748b" /></View>
                </Pressable>
              ))}
              <Text style={styles.demoHint}>Tap any to add as a demo document</Text>
            </View>
          )}

          {docs.length > 0 && (
            <View style={styles.demoSection}>
              <Text style={styles.docSectionLabel}>{docs.length} document{docs.length !== 1 ? 's' : ''} added</Text>
              {docs.map((doc) => (
                <View key={doc.id} style={styles.uploadedDocCard}>
                  <View style={styles.docIcon}>{DOC_ICONS[doc.type]}</View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docName}>{doc.name}</Text>
                    <Text style={styles.docMeta}>{DOC_LABELS[doc.type]} · {doc.size}</Text>
                  </View>
                  <Pressable onPress={() => onRemoveDoc(doc.id)} style={styles.removeButton}>
                    <X size={14} color="#64748b" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footerArea}>
          <Pressable
            accessibilityRole="button"
            onPress={onProcess}
            disabled={docs.length === 0}
            style={[styles.primaryButton, docs.length === 0 && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>Analyse documents</Text>
            <ArrowRight size={18} color="#ffffff" />
          </Pressable>
          <View style={styles.privacyRowCompact}>
            <Shield size={12} color="#64748b" />
            <Text style={styles.privacySmallText}>Processed on-device only</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function ProcessingStep({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  React.useEffect(() => {
    let stepIndex = 0;
    let elapsed = 0;
    const total = PROCESSING_STEPS.length * 1200;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const runStep = () => {
      if (stepIndex >= PROCESSING_STEPS.length) {
        setDone(true);
        setProgress(100);
        const doneTimer = setTimeout(onComplete, 900);
        timers.push(doneTimer);
        return;
      }

      setCurrentStep(stepIndex);
      const interval = setInterval(() => {
        elapsed += 80;
        setProgress(Math.min(100, Math.round((elapsed / total) * 100)));
      }, 80);
      timers.push(interval as unknown as ReturnType<typeof setTimeout>);

      const stepTimer = setTimeout(() => {
        clearInterval(interval);
        setCompletedSteps((prev) => [...prev, stepIndex]);
        stepIndex += 1;
        runStep();
      }, 1200);
      timers.push(stepTimer);
    };

    runStep();
    return () => {
      timers.forEach((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
    };
  }, [onComplete]);

  return (
    <View style={[styles.processingContainer, styles.processingBg]}>
      <View style={styles.statusBarProcessing}>
        <Text style={styles.statusTextProcessing}>9:41</Text>
        <View style={styles.statusSignal} />
      </View>

      <View style={styles.processingHeader}>
        <Text style={styles.stepTextProcessing}>Analysing</Text>
        <Text style={styles.processingTitle}>{done ? 'Analysis complete.' : 'Reading your\ndocuments…'}</Text>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressTopRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressValue}>{progress}%</Text>
        </View>
        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <View style={styles.processingList}>
        {PROCESSING_STEPS.map((step, index) => {
          const isDone = completedSteps.includes(index);
          const isActive = currentStep === index && !isDone;
          const isPending = !isDone && !isActive;

          return (
            <View key={index} style={[styles.processingRow, isActive && styles.processingRowActive]}>
              <View style={styles.processingRowIconWrap}>
                {isDone ? (
                  <CheckCircle2 size={18} color="#b8f2d6" />
                ) : isActive ? (
                  <View style={styles.spinnerDot} />
                ) : (
                  <View style={styles.pendingDot} />
                )}
              </View>
              <Text style={[styles.processingText, isDone && styles.processingTextDone, isActive && styles.processingTextActive, isPending && styles.processingTextPending]}>
                {step}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.processingFooter}>
        <View style={styles.processingNote}>
          <Shield size={15} color="#8de4b9" />
          <Text style={styles.processingNoteText}>All analysis runs locally on your device. Your documents are never uploaded to any server.</Text>
        </View>
      </View>
    </View>
  );
}

type FlowState = 'welcome' | 'project-type' | 'add-documents' | 'processing';

const KnowledgeEmbeddingLaunchScreen: React.FC = () => {
  const vm = useKnowledgeEmbeddingFlow();
  const [currentStep, setCurrentStep] = useState<FlowState>('welcome');
  const [address, setAddress] = useState('');
  const [selectedType, setSelectedType] = useState<ConstructionType>(null);
  const [docs, setDocs] = useState<DocFile[]>([]);

  const title = useMemo(() => {
    if (currentStep === 'welcome') return 'Welcome';
    if (currentStep === 'project-type') return 'Type';
    if (currentStep === 'add-documents') return 'Documents';
    return 'Processing';
  }, [currentStep]);

  const handleAddDemoDoc = (demo: Omit<DocFile, 'status'>) => {
    setDocs((prev) => (prev.some((item) => item.id === demo.id) ? prev : [{ ...demo, status: 'ready' as const }, ...prev]));
  };

  const handleRemoveDoc = (id: string) => {
    setDocs((prev) => prev.filter((doc) => doc.id !== id));
  };

  if (vm.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Preparing your project setup…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.outerStage}>
        <View style={styles.phoneFrame}>
          {currentStep === 'welcome' && (
            <WelcomeStep address={address} setAddress={setAddress} onStart={() => setCurrentStep('project-type')} />
          )}

          {currentStep === 'project-type' && (
            <ProjectTypeStep
              selected={selectedType}
              setSelected={setSelectedType}
              onBack={() => setCurrentStep('welcome')}
              onContinue={() => setCurrentStep('add-documents')}
            />
          )}

          {currentStep === 'add-documents' && (
            <UploadDocumentsStep
              docs={docs}
              onAddDemoDoc={handleAddDemoDoc}
              onRemoveDoc={handleRemoveDoc}
              onProcess={() => setCurrentStep('processing')}
            />
          )}

          {currentStep === 'processing' && <ProcessingStep onComplete={() => setCurrentStep('welcome')} />}
        </View>

        <View style={styles.tabBar}>
          {(['welcome', 'project-type', 'add-documents', 'processing'] as FlowState[]).map((screen) => (
            <Pressable
              key={screen}
              onPress={() => setCurrentStep(screen)}
              style={[styles.tabButton, currentStep === screen && styles.tabButtonActive]}
            >
              <Text style={[styles.tabLabel, currentStep === screen && styles.tabLabelActive]}>{titleMap[screen]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
};

const titleMap: Record<FlowState, string> = {
  welcome: 'Welcome',
  'project-type': 'Type',
  'add-documents': 'Documents',
  processing: 'Processing',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#e8edf5',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef4ff',
  },
  loadingText: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  outerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  phoneFrame: {
    width: 390,
    maxWidth: '92%',
    height: 844,
    maxHeight: '90%',
    backgroundColor: '#f8fafc',
    borderRadius: 42,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  phoneShell: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  statusText: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '600',
    opacity: 0.7,
  },
  statusSignal: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#0f172a',
    opacity: 0.18,
  },
  heroArea: {
    height: 320,
    backgroundColor: '#153860',
    position: 'relative',
    overflow: 'hidden',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.12,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  heroIconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroIconCircle: {
    width: 86,
    height: 86,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(154, 210, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(156, 210, 255, 0.32)',
  },
  orbitOne: {
    position: 'absolute',
    right: 92,
    top: 42,
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitTwo: {
    position: 'absolute',
    left: 86,
    bottom: 54,
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(115, 174, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(156, 210, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitThree: {
    position: 'absolute',
    left: 98,
    top: 70,
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLabel: {
    position: 'absolute',
    left: 20,
    top: 20,
  },
  brandText: {
    color: '#dfe9ff',
    opacity: 0.9,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  contentPanel: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 8,
  },
  heading: {
    fontSize: 34,
    lineHeight: 40,
    color: '#0f172a',
    fontWeight: '700',
    marginBottom: 12,
  },
  accentText: {
    color: '#3b82f6',
    fontStyle: 'italic',
  },
  subheading: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 18,
  },
  bulletList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    fontSize: 14,
    color: '#334155',
  },
  ctaWrap: {
    marginTop: 18,
  },
  labelText: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
    marginBottom: 14,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  privacyText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    flexShrink: 1,
  },
  headerSection: {
    backgroundColor: '#153860',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerSectionAlt: {
    backgroundColor: '#153860',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    opacity: 0.8,
  },
  backText: {
    color: '#dfe9ff',
    fontSize: 14,
    opacity: 0.9,
  },
  stepText: {
    color: '#7ec3ff',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    marginBottom: 6,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    lineHeight: 20,
  },
  optionsList: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#dfe6f0',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
  },
  optionCardSelected: {
    borderColor: '#7ec3ff',
    backgroundColor: '#f0f7ff',
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: {
    backgroundColor: '#2563eb',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#2563eb',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  futureField: {
    borderWidth: 1,
    borderColor: '#dfe6f0',
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: '#f8fafc',
    opacity: 0.7,
  },
  futureText: {
    color: '#64748b',
    fontSize: 14,
  },
  footerArea: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
  },
  documentsList: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    gap: 16,
  },
  dropZone: {
    borderWidth: 2,
    borderColor: '#dfe6f0',
    borderStyle: 'dashed',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    paddingVertical: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dropZoneIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropZoneTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  dropZoneHint: {
    fontSize: 12,
    color: '#64748b',
  },
  demoSection: {
    gap: 10,
  },
  docSectionLabel: {
    fontSize: 11,
    color: '#64748b',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dfe6f0',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  docIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  docMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  chevronWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoHint: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
  uploadedDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dfe6f0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  privacySmallText: {
    fontSize: 11,
    color: '#64748b',
  },
  processingContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  processingBg: {
    backgroundColor: '#153860',
  },
  statusBarProcessing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statusTextProcessing: {
    color: '#dfe9ff',
    opacity: 0.7,
    fontSize: 12,
    fontWeight: '600',
  },
  processingHeader: {
    marginTop: 12,
    marginBottom: 12,
  },
  stepTextProcessing: {
    color: '#8ecbff',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    fontWeight: '600',
  },
  processingTitle: {
    color: '#f8fafc',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progressValue: {
    color: '#8ecbff',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progressBarBackground: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#8ecbff',
  },
  processingList: {
    flex: 1,
    gap: 8,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  processingRowActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  processingRowIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderTopColor: '#8ecbff',
    borderRightColor: 'rgba(255,255,255,0.3)',
    borderBottomColor: 'rgba(255,255,255,0.3)',
    borderLeftColor: 'rgba(255,255,255,0.3)',
    transform: [{ rotate: '45deg' }],
  },
  pendingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  processingText: {
    flex: 1,
    color: '#dfe9ff',
    fontSize: 14,
    opacity: 0.35,
  },
  processingTextActive: {
    opacity: 1,
    fontWeight: '600',
  },
  processingTextDone: {
    opacity: 0.65,
    textDecorationLine: 'line-through',
  },
  processingTextPending: {
    opacity: 0.25,
  },
  processingFooter: {
    marginTop: 10,
  },
  processingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  processingNoteText: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 18,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
  },
  tabButtonActive: {
    backgroundColor: '#0f172a',
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#64748b',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#ffffff',
  },
});

export default KnowledgeEmbeddingLaunchScreen;
