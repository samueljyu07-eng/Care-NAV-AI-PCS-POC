"use client";

import { useEffect, useState } from "react";
import {
  CLINIC_REFERRAL_STATUSES,
  REFERRAL_STATUS_LABEL,
  REFERRAL_STATUSES,
  type ClinicReferralStatus,
} from "../../lib/booking/model";
import type { ReferralDetail, ReferralListResult } from "../../lib/portal/types";
import { signOutPortal } from "./actions";
import { PatientCard } from "./patient-card";

const selectClass =
  "min-h-12 rounded-xl border border-[#E2E2E2] bg-white px-3 text-base text-black";

export function PortalHome() {
  const [clinicId, setClinicId] = useState("");
  const [clinicianId, setClinicianId] = useState("");
  const [status, setStatus] = useState("");
  const [list, setList] = useState<ReferralListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReferralDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    const open = () => setPrintOpen(true);
    const close = () => setPrintOpen(false);
    window.addEventListener("beforeprint", open);
    window.addEventListener("afterprint", close);
    return () => {
      window.removeEventListener("beforeprint", open);
      window.removeEventListener("afterprint", close);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (clinicId) {
      params.set("clinicId", clinicId);
    }
    if (clinicianId) {
      params.set("clinicianId", clinicianId);
    }
    if (status) {
      params.set("status", status);
    }
    void fetch(`/api/portal/referrals?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.reload();
          return;
        }
        if (!response.ok) {
          throw new Error("list");
        }
        setList((await response.json()) as ReferralListResult);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") {
          return;
        }
        setError("The referral list could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [clinicId, clinicianId, status, refresh]);

  async function openReferral(id: string) {
    setDetailLoading(true);
    setStatusError(null);
    setDetail(null);
    const response = await fetch(`/api/portal/referrals/${id}`, { cache: "no-store" });
    if (response.status === 401) {
      window.location.reload();
      return;
    }
    if (!response.ok) {
      setDetailLoading(false);
      setError("That referral could not be opened.");
      return;
    }
    setDetail((await response.json()) as ReferralDetail);
    setDetailLoading(false);
  }

  async function changeStatus(next: ClinicReferralStatus) {
    if (!detail || savingStatus) {
      return;
    }
    setSavingStatus(true);
    setStatusError(null);
    const response = await fetch(`/api/portal/referrals/${detail.id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setSavingStatus(false);
    if (response.status === 401) {
      window.location.reload();
      return;
    }
    if (!response.ok) {
      setStatusError("That status could not be saved.");
      return;
    }
    setDetail((await response.json()) as ReferralDetail);
  }

  async function printCard() {
    if (!detail) {
      return;
    }
    const response = await fetch(`/api/portal/referrals/${detail.id}/print-log`, { method: "POST" });
    if (!response.ok) {
      setStatusError("The print could not be recorded.");
      return;
    }
    window.print();
  }

  const showingDetail = detail !== null || detailLoading;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="portal-chrome flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Clinic portal</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[#545454]">
            Review CareNav referrals. This shared page is temporary until each clinic signs in.
          </p>
        </div>
        <form action={signOutPortal}>
          <button
            type="submit"
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-[#E2E2E2] bg-white px-5 text-base font-medium text-black hover:bg-[#F6F6F6]"
          >
            Sign out
          </button>
        </form>
      </div>

      {showingDetail ? (
        <DetailView
          detail={detail}
          loading={detailLoading}
          saving={savingStatus}
          error={statusError}
          printOpen={printOpen}
          onBack={() => {
            setDetail(null);
            setStatusError(null);
            setLoading(true);
            setError(null);
            setRefresh((current) => current + 1);
          }}
          onStatus={(next) => void changeStatus(next)}
          onPrint={() => void printCard()}
        />
      ) : (
        <ListView
          clinicId={clinicId}
          clinicianId={clinicianId}
          status={status}
          list={list}
          loading={loading}
          error={error}
          onClinic={(value) => {
            setLoading(true);
            setError(null);
            setClinicId(value);
            setClinicianId("");
          }}
          onClinician={(value) => {
            setLoading(true);
            setError(null);
            setClinicianId(value);
          }}
          onStatus={(value) => {
            setLoading(true);
            setError(null);
            setStatus(value);
          }}
          onOpen={(id) => void openReferral(id)}
        />
      )}
    </main>
  );
}

function ListView({
  clinicId,
  clinicianId,
  status,
  list,
  loading,
  error,
  onClinic,
  onClinician,
  onStatus,
  onOpen,
}: {
  clinicId: string;
  clinicianId: string;
  status: string;
  list: ReferralListResult | null;
  loading: boolean;
  error: string | null;
  onClinic: (value: string) => void;
  onClinician: (value: string) => void;
  onStatus: (value: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <div className="portal-chrome grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-[#545454]">
          Clinic
          <select className={selectClass} value={clinicId} onChange={(event) => onClinic(event.target.value)}>
            <option value="">All clinics</option>
            {(list?.clinics ?? []).map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </select>
          <span>Temporary. Later, signing in opens one clinic.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#545454]">
          Clinician
          <select
            className={selectClass}
            value={clinicianId}
            onChange={(event) => onClinician(event.target.value)}
          >
            <option value="">All clinicians</option>
            {(list?.clinicians ?? []).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#545454]">
          Status
          <select className={selectClass} value={status} onChange={(event) => onStatus(event.target.value)}>
            <option value="">All statuses</option>
            {REFERRAL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {REFERRAL_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Summary summary={list?.summary ?? null} />

      {error ? <p className="text-base leading-7 text-red-950">{error}</p> : null}
      {loading ? <p className="text-base leading-7 text-[#545454]">Loading referrals…</p> : null}
      {!loading && list && list.referrals.length === 0 ? (
        <p className="text-base leading-7 text-[#545454]">No referrals match these filters.</p>
      ) : null}

      {!loading && list && list.referrals.length > 0 ? (
        <>
          <div className="portal-chrome hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-base">
              <thead>
                <tr className="border-b border-[#E2E2E2] text-sm text-[#545454]">
                  <th className="px-3 py-3 font-medium">Received</th>
                  <th className="px-3 py-3 font-medium">Patient</th>
                  <th className="px-3 py-3 font-medium">Age</th>
                  <th className="px-3 py-3 font-medium">Clinician</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Patient says</th>
                </tr>
              </thead>
              <tbody>
                {list.referrals.map((item) => (
                  <tr
                    key={item.id}
                    className={
                      item.status === "new"
                        ? "border-b border-amber-100 bg-amber-50"
                        : "border-b border-[#E2E2E2]"
                    }
                  >
                    <td className="px-3 py-3 align-top text-[#545454]">{item.receivedLabel}</td>
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => onOpen(item.id)}
                        className="cursor-pointer text-left font-medium text-black underline decoration-black underline-offset-4"
                      >
                        {item.patientName}
                      </button>
                    </td>
                    <td className="px-3 py-3 align-top">{item.ageLabel}</td>
                    <td className="px-3 py-3 align-top">{item.clinicianName}</td>
                    <td className="px-3 py-3 align-top">{item.statusLabel}</td>
                    <td className="px-3 py-3 align-top">{item.patientSaysLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="portal-chrome flex flex-col gap-3 md:hidden">
            {list.referrals.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  className={
                    item.status === "new"
                      ? "flex w-full cursor-pointer flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-left"
                      : "flex w-full cursor-pointer flex-col gap-1 rounded-xl border border-[#E2E2E2] bg-white px-4 py-4 text-left"
                  }
                >
                  <span className="text-sm text-[#545454]">{item.receivedLabel}</span>
                  <span className="text-base font-semibold text-black">{item.patientName}</span>
                  <span className="text-base text-black">
                    {item.ageLabel} · {item.clinicianName}
                  </span>
                  <span className="text-base text-black">
                    {item.statusLabel} · Patient says {item.patientSaysLabel}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

function Summary({ summary }: { summary: ReferralListResult["summary"] | null }) {
  const month = summary?.thisMonth ?? "–";
  const selfReported = summary?.selfReportedBooked ?? "–";
  const confirmed = summary?.clinicConfirmedBooked ?? "–";
  return (
      <section aria-label="This month" className="portal-chrome flex flex-col gap-3">
        <h2 className="text-base font-semibold text-black">This month</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <Stat label="Referrals this month" value={month} />
          </div>
          <Stat label="Patient says booked" value={selfReported} />
          <Stat label="Clinic confirmed booked" value={confirmed} />
        </div>
      </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[#E2E2E2] bg-[#F6F6F6] px-4 py-4">
      <p className="text-sm text-[#545454]">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-black">{value}</p>
    </div>
  );
}

function DetailView({
  detail,
  loading,
  saving,
  error,
  printOpen,
  onBack,
  onStatus,
  onPrint,
}: {
  detail: ReferralDetail | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  printOpen: boolean;
  onBack: () => void;
  onStatus: (status: ClinicReferralStatus) => void;
  onPrint: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="portal-chrome flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center self-start rounded-full border border-[#E2E2E2] bg-white px-5 text-base font-medium text-black hover:bg-[#F6F6F6]"
          >
            Back to referrals
          </button>
          <button
            type="button"
            onClick={onPrint}
            disabled={!detail}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center self-start rounded-full bg-black px-5 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Print / Save as PDF
          </button>
        </div>
        {detail ? (
          <div className="flex flex-col gap-3">
            <p className="text-base leading-7 text-black">
              Clinic status: {detail.statusLabel}. Patient says: {detail.patientSaysLabel}.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row" role="group" aria-label="Clinic status">
              {CLINIC_REFERRAL_STATUSES.map((value) => {
                const selected = detail.status === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={saving}
                    onClick={() => onStatus(value)}
                    className={
                      selected
                        ? "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-black px-5 text-base font-medium text-white disabled:opacity-40"
                        : "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full border border-[#E2E2E2] bg-white px-5 text-base font-medium text-black hover:bg-[#F6F6F6] disabled:opacity-40"
                    }
                  >
                    {value === "closed" ? "Closed / Not a fit" : REFERRAL_STATUS_LABEL[value]}
                  </button>
                );
              })}
            </div>
            {error ? <p className="text-base leading-7 text-red-950">{error}</p> : null}
          </div>
        ) : null}
      </div>
      {loading ? <p className="text-base leading-7 text-[#545454]">Loading the referral…</p> : null}
      {detail ? <PatientCard detail={detail} forceOpen={printOpen} /> : null}
    </div>
  );
}
