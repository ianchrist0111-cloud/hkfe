import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AuthPages.module.css';

import { useAuthStore, useWalletStore } from '../store';
import { api } from '../lib/api';
import {
  IconCheckCircle,
  IconAlertCircle,
  IconRefreshCw,
  IconFileText,
  IconInfo,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconShieldCheck,
  IconHeadphones,
  IconCopy,
  IconClock
} from '../components/common/Icons';

const STEPS = ['Personal & AML', 'Address', 'ID & Biometrics'];

export default function KycPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [copiedCase, setCopiedCase] = useState(false);

  // Live status from backend
  const [kycRecordData, setKycRecordData] = useState<{
    caseReference?: string;
    submittedAt?: string;
    reviewNotes?: string;
    documentType?: string;
    documentNumberMasked?: string;
  } | null>(null);

  // Form State
  const [form, setForm] = useState({
    // Step 1: Personal
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    dob: user?.dateOfBirth || '',
    phone: user?.phoneNumber || '',
    nationality: 'United States',
    occupation: 'Financial Analyst / Investor',
    sourceOfFunds: 'Employment / Trading Profits',

    // Step 2: Address
    street: '',
    city: '',
    state: 'NY',
    zip: '',
    country: 'US',

    // Step 3: Documents & Biometrics
    docType: 'passport' as 'passport' | 'drivers_license' | 'national_id',
    docNumber: '',
    docExpiry: '',
    docFront: '',
    docBack: '',
    selfie: '',
    consent: false,
  });

  const [stepErrors, setStepErrors] = useState<string | null>(null);

  // File Inputs
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // File details preview
  const [frontFileName, setFrontFileName] = useState('');
  const [backFileName, setBackFileName] = useState('');
  const [selfieFileName, setSelfieFileName] = useState('');

  // Fetch verified KYC status from backend
  const fetchKycStatus = async () => {
    try {
      const res = await api.getKycStatus();
      if (res.success && res.data) {
        setKycRecordData(res.data);
        if (res.data.kycStatus && res.data.kycStatus !== user?.kycStatus) {
          updateUser({ kycStatus: res.data.kycStatus });
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchKycStatus();
  }, []);

  const processImageFile = (file: File, target: 'front' | 'back' | 'selfie') => {
    setStepErrors(null);
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setStepErrors('Please select a valid image (JPEG, PNG, WEBP) or PDF document.');
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setStepErrors('File size exceeds 2.5MB limit. Please upload a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (target === 'front') {
        setFrontFileName(file.name);
        setForm(f => ({ ...f, docFront: dataUrl }));
      } else if (target === 'back') {
        setBackFileName(file.name);
        setForm(f => ({ ...f, docBack: dataUrl }));
      } else if (target === 'selfie') {
        setSelfieFileName(file.name);
        setForm(f => ({ ...f, selfie: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Sample ID helper for fast verification testing
  const handleUseSampleVerification = () => {
    setForm(f => ({
      ...f,
      docNumber: f.docNumber || 'P984210452',
      docExpiry: f.docExpiry || '2030-08-15',
      docFront: 'sample-verified-us-passport.jpg',
      docBack: f.docType === 'passport' ? '' : 'sample-verified-id-back.jpg',
      selfie: 'sample-liveness-face-verified.jpg',
      consent: true,
    }));
    setFrontFileName('official-passport-front.jpg');
    if (form.docType !== 'passport') setBackFileName('official-license-back.jpg');
    setSelfieFileName('biometric-liveness-scan.jpg');
    setStepErrors(null);
  };

  const handleNext = async () => {
    setStepErrors(null);

    // Validation for Step 0 (Personal)
    if (step === 0) {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        setStepErrors('Please enter your legal first and last name as shown on your government ID.');
        return;
      }
      if (!form.dob) {
        setStepErrors('Please provide your date of birth.');
        return;
      }
      const dobDate = new Date(form.dob);
      const today = new Date();
      const age = today.getFullYear() - dobDate.getFullYear();
      if (age < 18) {
        setStepErrors('You must be at least 18 years of age to register for an institutional account.');
        return;
      }
      if (!form.phone.trim()) {
        setStepErrors('Please provide a valid phone number for account security verification.');
        return;
      }
      setStep(1);
      return;
    }

    // Validation for Step 1 (Address)
    if (step === 1) {
      if (!form.street.trim() || !form.city.trim() || !form.zip.trim()) {
        setStepErrors('Please complete all primary residential address fields.');
        return;
      }
      setStep(2);
      return;
    }

    // Validation for Step 2 (Documents & Biometrics)
    if (step === 2) {
      if (!form.docNumber.trim()) {
        setStepErrors('Please enter your government document identification number.');
        return;
      }
      if (!form.docFront) {
        setStepErrors('Please upload the front photo of your government-issued ID.');
        return;
      }
      if (form.docType !== 'passport' && !form.docBack) {
        setStepErrors('Drivers license and National ID cards require both front and back photos.');
        return;
      }
      if (!form.selfie) {
        setStepErrors('Please complete the selfie liveness photo verification.');
        return;
      }
      if (!form.consent) {
        setStepErrors('You must confirm the legal accuracy declaration before submission.');
        return;
      }

      // Submit full KYC application to backend
      setSubmitting(true);
      try {
        await api.submitKycStep1({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          dateOfBirth: form.dob,
          phoneNumber: form.phone.trim(),
          nationality: form.nationality,
          occupation: form.occupation,
          sourceOfFunds: form.sourceOfFunds,
        });

        await api.submitKycStep2({
          addressLine1: form.street.trim(),
          city: form.city.trim(),
          state: form.state,
          zipCode: form.zip.trim(),
          country: form.country,
        });

        const res = await api.submitKycStep3({
          documentType: form.docType,
          documentNumber: form.docNumber.trim(),
          documentExpiry: form.docExpiry || undefined,
          documentRef: form.docFront,
          documentBackRef: form.docBack || undefined,
          selfieRef: form.selfie,
          consent: true,
        });

        if (res.success && res.data) {
          updateUser({
            kycStatus: 'pending',
            firstName: form.firstName,
            lastName: form.lastName,
          });
          setKycRecordData({
            caseReference: res.data.caseReference,
            submittedAt: res.data.submittedAt,
            documentType: form.docType,
            documentNumberMasked: `•••• ${form.docNumber.slice(-4)}`,
          });
          setResubmitting(false);
        } else {
          setStepErrors(res.error?.message || 'Failed to submit verification. Please verify details.');
        }
      } catch (err: any) {
        setStepErrors(err.message || 'Network error submitting application.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleInquireSupport = () => {
    const caseRef = kycRecordData?.caseReference || 'KYC-INQUIRY';
    window.dispatchEvent(
      new CustomEvent('open-support-modal', {
        detail: {
          category: 'kyc',
          subject: `Status Inquiry: KYC Case ${caseRef}`,
          message: `Hello Compliance Desk, I would like to inquire about the review status of my identity verification application (${caseRef}). Please provide any updates or let me know if additional documentation is required.`,
        },
      })
    );
  };

  const handleCopyCase = () => {
    if (kycRecordData?.caseReference) {
      navigator.clipboard?.writeText(kycRecordData.caseReference);
      setCopiedCase(true);
      setTimeout(() => setCopiedCase(false), 2500);
    }
  };

  // State 1: User is already APPROVED
  if (user?.kycStatus === 'approved' && !resubmitting) {
    return (
      <div className={styles.page}>
        <div className={styles.bg} />
        <div className={styles.card} style={{ maxWidth: 540 }}>
          <div className={styles.verifyScreen}>
            <div className={styles.checkCircle}>
              <IconCheckCircle size={48} color="var(--color-gain)" />
            </div>
            <h2 style={{ marginBottom: 'var(--space-2)' }}>Institutional Identity Verified</h2>
            <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Your account has full Tier-1 institutional compliance status. All trading restrictions and simulated funding limits are lifted.
            </p>

            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid rgba(0, 229, 153, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              textAlign: 'left',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginBottom: '20px',
              width: '100%',
              boxSizing: 'border-box',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Verification Tier:</span>
                <strong style={{ color: 'var(--brand-mint-500)' }}>Tier-1 Institutional</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Verified Entity:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user.firstName} {user.lastName} ({user.email})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span className="badge badge-gain">ACTIVE & VERIFIED</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Trading Access:</span>
                <span style={{ color: 'var(--text-primary)' }}>Forex, Crypto, Equities, DCA & Grid Bots</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                className={styles.btnSubmit}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => navigate('/dashboard')}
              >
                <span>Go to Trading Terminal</span>
                <IconArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: User is PENDING Review (Realistic compliance inquiry view)
  if (user?.kycStatus === 'pending' && !resubmitting) {
    const caseRef = kycRecordData?.caseReference || 'KYC-791024';
    return (
      <div className={styles.page}>
        <div className={styles.bg} />
        <div className={styles.card} style={{ maxWidth: 540 }}>
          <div className={styles.verifyScreen}>
            <div style={{ marginBottom: '16px' }}>
              <IconRefreshCw size={44} color="var(--brand-bot-500)" />
            </div>

            <h2 style={{ marginBottom: '6px', fontSize: '20px' }}>Application Under Compliance Review</h2>
            <p style={{ marginBottom: '18px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Your government identity documents and biometrics have been dispatched to our compliance queue. An institutional compliance officer is currently evaluating your dossier.
            </p>

            {/* Case Reference Box */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: '10px',
              padding: '10px 14px',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '18px',
              boxSizing: 'border-box',
            }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                  Compliance Case Reference
                </span>
                <strong className="mono" style={{ fontSize: '15px', color: 'var(--brand-mint-500)' }}>
                  {caseRef}
                </strong>
              </div>
              <button
                type="button"
                onClick={handleCopyCase}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  padding: '5px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <IconCopy size={12} />
                <span>{copiedCase ? '✓ Copied' : 'Copy Case ID'}</span>
              </button>
            </div>

            {/* 4-Step Compliance Pipeline */}
            <div style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '20px',
              textAlign: 'left',
              boxSizing: 'border-box',
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 10 }}>
                Verification Progress Timeline
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-gain)' }}>
                  <IconCheckCircle size={15} />
                  <span>Dossier & Government ID Submitted</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-gain)' }}>
                  <IconCheckCircle size={15} />
                  <span>Automated AML & Sanctions Database Screen (Passed)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-gold)' }}>
                  <IconClock size={15} />
                  <span><strong>Compliance Officer Evaluation</strong> (In Queue · Est SLA: 1–2 hours)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                  <IconShieldCheck size={15} />
                  <span>Institutional Tier-1 Account Clearance (Pending)</span>
                </div>
              </div>
            </div>

            {/* Inquiry & Dashboard Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <button
                type="button"
                className="tapticPress"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 229, 153, 0.15), rgba(0, 179, 119, 0.05))',
                  border: '1px solid var(--brand-mint-500)',
                  color: 'var(--brand-mint-500)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 18px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onClick={handleInquireSupport}
              >
                <IconHeadphones size={16} />
                <span>Inquire with Compliance Desk Regarding Case</span>
              </button>

              <button
                type="button"
                className={styles.btnSubmit}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
                onClick={() => navigate('/dashboard')}
              >
                <span>Continue to Dashboard (Read-Only Mode)</span>
                <IconArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 3: User is REJECTED
  if (user?.kycStatus === 'rejected' && !resubmitting) {
    const feedback = kycRecordData?.reviewNotes || 'Document image blurry or illegible. Please submit a valid passport or clear license.';
    return (
      <div className={styles.page}>
        <div className={styles.bg} />
        <div className={styles.card} style={{ maxWidth: 540 }}>
          <div className={styles.verifyScreen}>
            <div style={{ marginBottom: '16px' }}>
              <IconAlertCircle size={44} color="var(--color-loss)" />
            </div>
            <h2 style={{ marginBottom: '6px', color: 'var(--color-loss)', fontSize: '20px' }}>
              Verification Action Required
            </h2>
            <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5 }}>
              Our compliance officer was unable to verify your identity with the uploaded documents. Please review the compliance findings below.
            </p>

            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--color-loss)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: '20px',
              textAlign: 'left',
              fontSize: '13px',
              color: 'var(--text-primary)',
              width: '100%',
              boxSizing: 'border-box',
            }}>
              <strong style={{ color: 'var(--color-loss)', display: 'block', marginBottom: 4 }}>
                Compliance Officer Findings:
              </strong>
              "{feedback}"
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <button
                type="button"
                className={styles.btnSubmit}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                onClick={() => {
                  setResubmitting(true);
                  setStep(2);
                }}
              >
                <IconFileText size={16} />
                <span>Resubmit Clear Government ID Documents</span>
              </button>

              <button
                type="button"
                className="tapticPress"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onClick={handleInquireSupport}
              >
                <IconHeadphones size={15} />
                <span>Contact Compliance Desk / Contest Finding</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className={styles.page}>
        <div className={styles.bg} />
        <div className={styles.card}>
          <div className={styles.verifyScreen}>
            <div className={styles.spinnerLarge} />
            <h3 style={{ marginBottom: '8px' }}>Encrypting & Dispatching Dossier...</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Cryptographically registering documents with institutional compliance queue
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Multi-Step Form
  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.card} style={{ maxWidth: 560 }}>
        <div className={styles.cardHeader}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>HK</span>
            <span className={styles.logoText}>FES</span>
          </div>
          <h1>Institutional Identity Verification</h1>
          <p>Step {step + 1} of 3 — {STEPS[step]}</p>
        </div>

        {/* Stepper */}
        <div className={styles.stepper}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              <div className={`${styles.stepDot} ${i < step ? styles.done : ''} ${i === step ? styles.active : ''}`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`${styles.stepLine} ${i < step ? styles.done : ''}`} />
              )}
            </div>
          ))}
        </div>

        {stepErrors && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid var(--color-loss)',
            color: 'var(--color-loss)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '16px',
          }}>
            ⚠️ {stepErrors}
          </div>
        )}

        <div className={styles.form}>
          {/* STEP 0: Personal & AML */}
          {step === 0 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className={styles.field}>
                  <label>Legal First Name</label>
                  <input
                    placeholder="Alex"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Legal Last Name</label>
                  <input
                    placeholder="Chen"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className={styles.field}>
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label>Nationality / Citizenship</label>
                <input
                  placeholder="United States"
                  value={form.nationality}
                  onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className={styles.field}>
                  <label>Occupation</label>
                  <input
                    placeholder="Trader / Engineer"
                    value={form.occupation}
                    onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Source of Funds</label>
                  <select
                    value={form.sourceOfFunds}
                    onChange={e => setForm(f => ({ ...f, sourceOfFunds: e.target.value }))}
                  >
                    <option value="Employment / Trading Profits">Employment / Trading Profits</option>
                    <option value="Personal Investments">Personal Investments</option>
                    <option value="Business Revenue">Business Revenue</option>
                    <option value="Inheritance / Savings">Inheritance / Savings</option>
                  </select>
                </div>
              </div>

              <div className={styles.demoHint}>
                <IconInfo size={14} color="var(--brand-mint-500)" style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Your legal identity details are encrypted and processed pursuant to FinCEN Customer Due Diligence (CDD) standards.
              </div>
            </>
          )}

          {/* STEP 1: Address */}
          {step === 1 && (
            <>
              <div className={styles.field}>
                <label>Residential Street Address</label>
                <input
                  placeholder="100 Financial Way, Suite 400"
                  value={form.street}
                  onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className={styles.field}>
                  <label>City</label>
                  <input
                    placeholder="New York"
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>State / Region</label>
                  <select
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  >
                    {['NY', 'CA', 'TX', 'FL', 'IL', 'WA', 'PA', 'GA', 'MA', 'AZ', 'Other'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className={styles.field}>
                  <label>Postal / ZIP Code</label>
                  <input
                    placeholder="10005"
                    value={form.zip}
                    onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label>Country of Tax Residence</label>
                  <select
                    value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  >
                    <option value="US">United States (US)</option>
                    <option value="GB">United Kingdom (GB)</option>
                    <option value="CA">Canada (CA)</option>
                    <option value="AU">Australia (AU)</option>
                    <option value="SG">Singapore (SG)</option>
                    <option value="DE">Germany (DE)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* STEP 2: ID & Biometrics */}
          {step === 2 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                <div className={styles.field}>
                  <label>Document Type</label>
                  <select
                    value={form.docType}
                    onChange={e => setForm(f => ({ ...f, docType: e.target.value as any }))}
                  >
                    <option value="passport">Passport</option>
                    <option value="drivers_license">Driver's License</option>
                    <option value="national_id">National Identity Card</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label>ID Document Number</label>
                  <input
                    placeholder="P984210452"
                    value={form.docNumber}
                    onChange={e => setForm(f => ({ ...f, docNumber: e.target.value }))}
                  />
                </div>
              </div>

              {/* Hidden file inputs */}
              <input
                type="file"
                ref={frontInputRef}
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && processImageFile(e.target.files[0], 'front')}
              />
              <input
                type="file"
                ref={backInputRef}
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && processImageFile(e.target.files[0], 'back')}
              />
              <input
                type="file"
                ref={selfieInputRef}
                accept="image/*"
                capture="user"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && processImageFile(e.target.files[0], 'selfie')}
              />

              {/* Upload Slots Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: form.docType === 'passport' ? '1fr 1fr' : '1fr 1fr 1fr', gap: '8px', margin: '4px 0 10px 0' }}>
                {/* Front slot */}
                <div
                  style={{
                    border: '1px dashed var(--border-default)',
                    borderRadius: '8px',
                    padding: '12px 8px',
                    textAlign: 'center',
                    background: form.docFront ? 'rgba(0, 229, 153, 0.05)' : 'var(--bg-elevated)',
                    cursor: 'pointer',
                  }}
                  onClick={() => frontInputRef.current?.click()}
                >
                  <IconFileText size={22} color={form.docFront ? 'var(--brand-mint-500)' : 'var(--text-muted)'} />
                  <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                    {form.docFront ? '✓ Front Added' : 'Upload Front'}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    {frontFileName || 'Photo / PDF'}
                  </span>
                </div>

                {/* Back slot (for license/ID) */}
                {form.docType !== 'passport' && (
                  <div
                    style={{
                      border: '1px dashed var(--border-default)',
                      borderRadius: '8px',
                      padding: '12px 8px',
                      textAlign: 'center',
                      background: form.docBack ? 'rgba(0, 229, 153, 0.05)' : 'var(--bg-elevated)',
                      cursor: 'pointer',
                    }}
                    onClick={() => backInputRef.current?.click()}
                  >
                    <IconFileText size={22} color={form.docBack ? 'var(--brand-mint-500)' : 'var(--text-muted)'} />
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                      {form.docBack ? '✓ Back Added' : 'Upload Back'}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                      {backFileName || 'Photo / PDF'}
                    </span>
                  </div>
                )}

                {/* Selfie slot */}
                <div
                  style={{
                    border: '1px dashed var(--border-default)',
                    borderRadius: '8px',
                    padding: '12px 8px',
                    textAlign: 'center',
                    background: form.selfie ? 'rgba(0, 229, 153, 0.05)' : 'var(--bg-elevated)',
                    cursor: 'pointer',
                  }}
                  onClick={() => selfieInputRef.current?.click()}
                >
                  <span style={{ fontSize: '20px', display: 'block' }}>📸</span>
                  <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                    {form.selfie ? '✓ Selfie Captured' : 'Selfie Scan'}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    {selfieFileName || 'Liveness Biometric'}
                  </span>
                </div>
              </div>

              {/* Sample test button */}
              <div style={{ textAlign: 'right' }}>
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--brand-mint-500)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                  onClick={handleUseSampleVerification}
                >
                  ⚡ Autofill Verified Test Documents
                </button>
              </div>

              {/* Consent checkbox */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: 10, lineHeight: 1.4 }}>
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))}
                  style={{ marginTop: 2 }}
                />
                <span>
                  I declare under penalty of perjury that the submitted identification and documents are authentic, belong to me, and that I am the authorized beneficial owner of this account.
                </span>
              </label>
            </>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            {step > 0 && (
              <button
                type="button"
                className="tapticPress"
                style={{
                  flex: 1,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '12px',
                  minHeight: 46,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
                onClick={() => setStep(s => s - 1)}
              >
                <IconArrowLeft size={16} />
                <span>Back</span>
              </button>
            )}
            <button
              type="button"
              className={`tapticPress ${styles.btnSubmit}`}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 46 }}
              onClick={handleNext}
            >
              <span>{step < 2 ? 'Continue to Next Step' : 'Submit Application for Compliance Review'}</span>
              {step < 2 && <IconArrowRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
