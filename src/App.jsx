import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { BarChart3, Upload, X, Activity, DollarSign, Users, FileText, ChevronDown, ArrowUpDown } from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const THERAPY_CLASS_COLORS = {
  "Immune Globulin": "#2563eb",
  "Immune Therapy": "#7c3aed",
  "TNF Alfa Inhibitor": "#9333ea",
  "Anti-Infective/Antimicrobial": "#059669",
  "Chemotherapy": "#dc2626",
  "Parenteral Nutrition": "#ea580c",
  "Pain": "#0f766e",
  "Iron Therapy": "#d97706",
  "Enzyme": "#db2777",
  "Colony Stimulating Factor": "#0284c7",
  "Miscellaneous Infusion Therapy": "#475569",
  Unknown: "#64748b",
};

function colorForTherapyClass(therapyClass) {
  return THERAPY_CLASS_COLORS[therapyClass] || "#64748b";
}

const percent = (v) => `${(Number(v || 0) * 100).toFixed(1)}%`;
const dateFmt = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

function asNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

function computeAgeDays(start, end) {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.max(0, Math.round((b - a) / 86400000));
}

function bucketAge(days) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  if (days <= 120) return "91-120";
  return "120+";
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return "";
}

function parseCsvRows(rows) {
  return rows
    .filter((r) => r && Object.values(r).some((v) => String(v ?? "").trim() !== ""))
    .map((r) => {
      const normalized = Object.fromEntries(
        Object.entries(r).map(([k, v]) => [String(k).trim(), typeof v === "string" ? v.trim() : v])
      );
      return normalized;
    });
}

function sortRows(rows, sortConfig) {
  const { key, direction } = sortConfig || {};
  if (!key) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === "number" && typeof bv === "number") {
      return direction === "asc" ? av - bv : bv - av;
    }
    return direction === "asc"
      ? String(av ?? "").localeCompare(String(bv ?? ""))
      : String(bv ?? "").localeCompare(String(av ?? ""));
  });
  return copy;
}

function aggregateClaimGroups(lineRows) {
  const map = new Map();

  for (const row of lineRows) {
    const groupId = firstNonEmpty(row.claim_group_id, row.claim_id)?.toString();
    if (!groupId) continue;

    if (!map.has(groupId)) {
      map.set(groupId, {
        claim_group_id: groupId,
        patient_id: row.patient_id || "",
        date_of_service: row.date_of_service || "",
        date_charge_entered: row.date_charge_entered || "",
        date_claim_submitted: row.date_claim_submitted || "",
        date_claim_resolved: row.date_claim_resolved || "",
        payor: firstNonEmpty(row.payor, row.payor_category, "Unknown"),
        therapy_class: firstNonEmpty(row.therapy_class, row.drug_category, "Unknown"),
        therapy_name: firstNonEmpty(row.therapy_name, row.drug_name_brand, row.drug_name, "Unknown"),
        drug_name: firstNonEmpty(row.drug_name_brand, row.drug_name, row.therapy_name, "Unknown"),
        code_set: new Set(),
        denial_reason: "",
        claim_status: firstNonEmpty(row.claim_status, "Unknown"),
        billed_amount: 0,
        contractual_adjustment: 0,
        allowed_amount: 0,
        paid_amount: 0,
        patient_responsibility: 0,
        patient_paid: 0,
        current_ar_balance: 0,
        first_pass_accepted: false,
        initial_denial_flag: false,
        first_pass_resolved: false,
      });
    }

    const group = map.get(groupId);
    group.patient_id = firstNonEmpty(group.patient_id, row.patient_id);
    group.date_of_service = firstNonEmpty(group.date_of_service, row.date_of_service);
    group.date_charge_entered = firstNonEmpty(group.date_charge_entered, row.date_charge_entered);
    group.date_claim_submitted = firstNonEmpty(group.date_claim_submitted, row.date_claim_submitted);
    group.date_claim_resolved = firstNonEmpty(group.date_claim_resolved, row.date_claim_resolved);
    group.payor = firstNonEmpty(group.payor, row.payor, row.payor_category, "Unknown");
    group.therapy_class = firstNonEmpty(group.therapy_class, row.therapy_class, row.drug_category, "Unknown");
    group.therapy_name = firstNonEmpty(group.therapy_name, row.therapy_name, row.drug_name_brand, row.drug_name, "Unknown");
    group.drug_name = firstNonEmpty(group.drug_name, row.drug_name_brand, row.drug_name, row.therapy_name, "Unknown");
    if (row["billing codes"]) group.code_set.add(String(row["billing codes"]));
    if (!group.denial_reason && row.denial_reason) group.denial_reason = row.denial_reason;
    group.claim_status = firstNonEmpty(row.claim_status, group.claim_status, "Unknown");

    group.billed_amount += asNum(row.billed_amount);
    group.contractual_adjustment += asNum(row.contractual_adjustment);
    group.allowed_amount += asNum(row.allowed_amount);
    group.paid_amount += asNum(row.paid_amount);
    group.patient_responsibility += asNum(row.patient_responsibility);
    group.patient_paid += asNum(row.patient_paid);
    group.current_ar_balance += asNum(row.current_ar_balance);

    group.first_pass_accepted = group.first_pass_accepted || parseBool(row.first_pass_accepted);
    group.initial_denial_flag = group.initial_denial_flag || parseBool(row.initial_denial_flag) || String(row.claim_status || "").toLowerCase() === "denied";
    group.first_pass_resolved = group.first_pass_resolved || parseBool(row.first_pass_resolved);
  }

  const reportDate = new Date("2025-12-31");

  return Array.from(map.values()).map((g) => {
    const chargeLag = computeAgeDays(g.date_of_service, g.date_charge_entered);
    const arAge = g.current_ar_balance > 0
      ? computeAgeDays(g.date_claim_submitted, g.date_claim_resolved || reportDate.toISOString().slice(0, 10))
      : null;

    return {
      ...g,
      code_list: Array.from(g.code_set).sort(),
      total_collections: g.paid_amount + g.patient_paid,
      clean_claim_rate_flag: g.first_pass_accepted,
      denial_rate_flag: g.initial_denial_flag,
      zero_ar_flag: g.current_ar_balance <= 0.009,
      charge_lag_days: chargeLag,
      ar_age_days: arAge,
      ar_bucket: arAge !== null ? bucketAge(arAge) : null,
    };
  });
}

function useOptions(groups) {
  return useMemo(() => {
    const unique = (key) => Array.from(new Set(groups.map((g) => g[key]).filter(Boolean))).sort();
    const codeSet = new Set();
    groups.forEach((g) => (g.code_list || []).forEach((c) => codeSet.add(c)));
    return {
      payors: unique("payor"),
      therapyClasses: unique("therapy_class"),
      drugNames: unique("drug_name"),
      denialReasons: unique("denial_reason"),
      claimStatuses: unique("claim_status"),
      codes: Array.from(codeSet).sort(),
    };
  }, [groups]);
}

function MultiSelectFilter({ label, options, selected, onToggle, onClear, placeholder = "All" }) {
  const [open, setOpen] = useState(false);
  const selectedLabel = selected.length === 0 ? placeholder : `${selected.length} selected`;
  if (!options.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</Label>
        {selected.length > 0 ? (
          <button className="text-xs text-slate-500 hover:text-slate-800" onClick={onClear}>Clear</button>
        ) : null}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:border-slate-300"
        >
          <span className="truncate text-slate-700">{selectedLabel}</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
        {open ? (
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            <div className="space-y-1">
              {options.map((option) => {
                const active = selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onToggle(option)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    <span className="truncate">{option}</span>
                    {active ? <span className="text-xs">✓</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KpiCard({ title, value, subtitle, icon: Icon, accent = "from-slate-900 to-slate-700" }) {
  return (
    <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
      <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</div>
            {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
          </div>
          {Icon ? <div className="rounded-2xl bg-slate-50 p-2"><Icon className="h-5 w-5 text-slate-500" /></div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function AgingBoxes({ rows, onSelectBucket, activeBucket }) {
  const order = ["0-30", "31-60", "61-90", "91-120", "120+"];
  const total = rows.length || 1;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {order.map((bucket) => {
        const matches = rows.filter((r) => r.ar_bucket === bucket);
        const value = matches.length;
        const pct = value / total;
        const dollars = matches.reduce((sum, r) => sum + r.current_ar_balance, 0);
        const active = activeBucket === bucket;
        return (
          <button
            key={bucket}
            onClick={() => onSelectBucket(active ? null : bucket)}
            className={`rounded-3xl border p-4 text-left shadow-sm transition ${active ? "border-slate-900 bg-slate-900 text-white shadow-[0_10px_35px_rgba(15,23,42,0.28)]" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"}`}
          >
            <div className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${active ? "text-slate-200" : "text-slate-500"}`}>{bucket} days</div>
            <div className="mt-3 text-4xl font-bold tracking-tight">{value}</div>
            <div className={`mt-1 text-xs ${active ? "text-slate-200" : "text-slate-500"}`}>{percent(pct)} of open claims</div>
            <div className={`mt-3 text-sm font-semibold ${active ? "text-white" : "text-slate-700"}`}>{currency.format(dollars)}</div>
          </button>
        );
      })}
    </div>
  );
}

function SortableHeader({ label, sortKey, sortConfig, onSort, align = "left" }) {
  const active = sortConfig.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900 ${align === "right" ? "ml-auto" : ""}`}
    >
      {label}
      <ArrowUpDown className={`h-3.5 w-3.5 ${active ? "text-slate-900" : "text-slate-400"}`} />
    </button>
  );
}

function SummaryTable({ rows, dimensionKey, onSelect, activeValue, sortConfig, onSort }) {
  const sortedRows = sortRows(rows, sortConfig);
  return (
    <ScrollArea className="h-[340px] rounded-2xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead><SortableHeader label={dimensionKey} sortKey="value" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Claims" sortKey="claims" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Patients" sortKey="patients" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Collections" sortKey="collections" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Avg/Claim" sortKey="avgPerClaim" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="% of Collections" sortKey="share" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Denial Rate" sortKey="denialRate" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Open AR" sortKey="openAr" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((r) => {
            const active = activeValue === r.value;
            return (
              <TableRow
                key={r.value}
                className={`cursor-pointer transition ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
                onClick={() => onSelect(active ? null : r.value)}
              >
                <TableCell className="font-medium text-slate-900">{r.value}</TableCell>
                <TableCell className="text-right">{r.claims}</TableCell>
                <TableCell className="text-right">{r.patients}</TableCell>
                <TableCell className="text-right">{currency.format(r.collections)}</TableCell>
                <TableCell className="text-right">{currency.format(r.avgPerClaim)}</TableCell>
                <TableCell className="text-right">{percent(r.share)}</TableCell>
                <TableCell className="text-right">{percent(r.denialRate)}</TableCell>
                <TableCell className="text-right">{currency.format(r.openAr)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function DenialTable({ rows, onSelect, activeValue, sortConfig, onSort }) {
  const sortedRows = sortRows(rows, sortConfig);
  return (
    <ScrollArea className="h-[340px] rounded-2xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead><SortableHeader label="Category" sortKey="value" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Total Claims" sortKey="totalClaims" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Denied" sortKey="deniedClaims" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Denial Rate" sortKey="denialRate" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="% of Claims" sortKey="claimShare" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead><SortableHeader label="Top Denial Reason" sortKey="topReason" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead className="text-right"><SortableHeader label="AR at Risk" sortKey="arAtRisk" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((r) => {
            const active = activeValue === r.value;
            return (
              <TableRow
                key={r.value}
                className={`cursor-pointer transition ${active ? "bg-slate-100" : "hover:bg-slate-50"}`}
                onClick={() => onSelect(active ? null : r.value)}
              >
                <TableCell className="font-medium text-slate-900">{r.value}</TableCell>
                <TableCell className="text-right">{r.totalClaims}</TableCell>
                <TableCell className="text-right">{r.deniedClaims}</TableCell>
                <TableCell className="text-right">{percent(r.denialRate)}</TableCell>
                <TableCell className="text-right">{percent(r.claimShare)}</TableCell>
                <TableCell>{r.topReason || "—"}</TableCell>
                <TableCell className="text-right">{currency.format(r.arAtRisk)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

function DetailTable({ rows, sortConfig, onSort }) {
  const sortedRows = sortRows(rows, sortConfig);
  return (
    <ScrollArea className="h-[440px] rounded-2xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead><SortableHeader label="Claim Group" sortKey="claim_group_id" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead><SortableHeader label="Patient" sortKey="patient_id" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead><SortableHeader label="DOS" sortKey="date_of_service" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead><SortableHeader label="Payor" sortKey="payor" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead><SortableHeader label="Therapy Class" sortKey="therapy_class" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead><SortableHeader label="Therapy" sortKey="therapy_name" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead><SortableHeader label="Drug" sortKey="drug_name" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Billed" sortKey="billed_amount" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Allowed" sortKey="allowed_amount" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Insurer Paid" sortKey="paid_amount" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Patient Paid" sortKey="patient_paid" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="Collections" sortKey="total_collections" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead className="text-right"><SortableHeader label="AR" sortKey="current_ar_balance" sortConfig={sortConfig} onSort={onSort} align="right" /></TableHead>
            <TableHead><SortableHeader label="Denial Reason" sortKey="denial_reason" sortConfig={sortConfig} onSort={onSort} /></TableHead>
            <TableHead><SortableHeader label="Status" sortKey="claim_status" sortConfig={sortConfig} onSort={onSort} /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((r) => (
            <TableRow key={r.claim_group_id} className="hover:bg-slate-50">
              <TableCell className="font-medium">{r.claim_group_id}</TableCell>
              <TableCell>{r.patient_id}</TableCell>
              <TableCell>{dateFmt(r.date_of_service)}</TableCell>
              <TableCell>{r.payor}</TableCell>
              <TableCell>{r.therapy_class}</TableCell>
              <TableCell>{r.therapy_name}</TableCell>
              <TableCell>{r.drug_name}</TableCell>
              <TableCell className="text-right">{currency.format(r.billed_amount)}</TableCell>
              <TableCell className="text-right">{currency.format(r.allowed_amount)}</TableCell>
              <TableCell className="text-right">{currency.format(r.paid_amount)}</TableCell>
              <TableCell className="text-right">{currency.format(r.patient_paid)}</TableCell>
              <TableCell className="text-right">{currency.format(r.total_collections)}</TableCell>
              <TableCell className="text-right">{currency.format(r.current_ar_balance)}</TableCell>
              <TableCell>{r.denial_reason || "—"}</TableCell>
              <TableCell>{r.claim_status}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export default function HomeInfusionRevenueDashboard() {
  const [lineRows, setLineRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    dateStart: "",
    dateEnd: "",
    payors: [],
    therapyClasses: [],
    drugNames: [],
    codes: [],
    denialReasons: [],
    claimStatuses: [],
  });
  const [selectedViz, setSelectedViz] = useState({
    payor: null,
    therapyClass: null,
    drugName: null,
    denialReason: null,
    arBucket: null,
  });
  const [activeTherapyClassLegend, setActiveTherapyClassLegend] = useState(null);
  const [hoveredTherapyClassLegend, setHoveredTherapyClassLegend] = useState(null);
  const [summarySort, setSummarySort] = useState({ key: "collections", direction: "desc" });
  const [denialSort, setDenialSort] = useState({ key: "denialRate", direction: "desc" });
  const [detailSort, setDetailSort] = useState({ key: "date_of_service", direction: "desc" });

  const claimGroups = useMemo(() => aggregateClaimGroups(lineRows), [lineRows]);
  const options = useOptions(claimGroups);

  const filtered = useMemo(() => {
    return claimGroups.filter((g) => {
      if (filters.dateStart && new Date(g.date_of_service) < new Date(filters.dateStart)) return false;
      if (filters.dateEnd && new Date(g.date_of_service) > new Date(filters.dateEnd)) return false;
      if (filters.payors.length && !filters.payors.includes(g.payor)) return false;
      if (filters.therapyClasses.length && !filters.therapyClasses.includes(g.therapy_class)) return false;
      if (filters.drugNames.length && !filters.drugNames.includes(g.drug_name)) return false;
      if (filters.denialReasons.length && !filters.denialReasons.includes(g.denial_reason)) return false;
      if (filters.claimStatuses.length && !filters.claimStatuses.includes(g.claim_status)) return false;
      if (filters.codes.length && !g.code_list.some((c) => filters.codes.includes(c))) return false;
      if (selectedViz.payor && g.payor !== selectedViz.payor) return false;
      if (selectedViz.therapyClass && g.therapy_class !== selectedViz.therapyClass) return false;
      if (selectedViz.drugName && g.drug_name !== selectedViz.drugName) return false;
      if (selectedViz.denialReason && g.denial_reason !== selectedViz.denialReason) return false;
      if (selectedViz.arBucket && g.ar_bucket !== selectedViz.arBucket) return false;
      if (search) {
        const haystack = [
          g.claim_group_id,
          g.patient_id,
          g.payor,
          g.therapy_class,
          g.therapy_name,
          g.drug_name,
          g.denial_reason,
          g.claim_status,
          ...(g.code_list || []),
        ].join(" ").toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [claimGroups, filters, selectedViz, search]);

  const openArRows = useMemo(() => filtered.filter((g) => g.current_ar_balance > 0), [filtered]);

  const arValidation = useMemo(() => {
    const grouped = openArRows.map((g) => ({
      claim_group_id: g.claim_group_id,
      current_ar_balance: g.current_ar_balance,
      ar_bucket: g.ar_bucket,
    }));
    return {
      openClaims: grouped.length,
      totalAr: grouped.reduce((sum, g) => sum + g.current_ar_balance, 0),
      buckets: ["0-30", "31-60", "61-90", "91-120", "120+"].map((bucket) => ({
        bucket,
        claims: grouped.filter((g) => g.ar_bucket === bucket).length,
        dollars: grouped.filter((g) => g.ar_bucket === bucket).reduce((sum, g) => sum + g.current_ar_balance, 0),
      })),
    };
  }, [openArRows]);

  const kpis = useMemo(() => {
    const totalClaims = filtered.length;
    const totalPatients = new Set(filtered.map((g) => g.patient_id)).size;
    const uniqueTherapies = new Set(filtered.map((g) => g.drug_name).filter(Boolean)).size;
    const totalCollections = filtered.reduce((s, g) => s + g.total_collections, 0);
    const totalNetExpected = filtered.reduce((s, g) => s + (g.billed_amount - g.contractual_adjustment), 0);
    const totalPatientResponsibility = filtered.reduce((s, g) => s + g.patient_responsibility, 0);
    const totalPatientPaid = filtered.reduce((s, g) => s + g.patient_paid, 0);
    const cleanClaimRate = totalClaims ? filtered.filter((g) => g.clean_claim_rate_flag).length / totalClaims : 0;
    const initialDenialRate = totalClaims ? filtered.filter((g) => g.denial_rate_flag).length / totalClaims : 0;
    const firstPassResolutionRate = totalClaims ? filtered.filter((g) => g.first_pass_resolved).length / totalClaims : 0;
    const netCollectionRate = totalNetExpected ? totalCollections / totalNetExpected : 0;
    const patientCollectionRate = totalPatientResponsibility ? totalPatientPaid / totalPatientResponsibility : 0;
    const zeroArClaims = totalClaims ? filtered.filter((g) => g.zero_ar_flag).length / totalClaims : 0;
    const avgChargeLag = totalClaims ? filtered.map((g) => g.charge_lag_days || 0).reduce((a, b) => a + b, 0) / totalClaims : 0;
    const openArDays = openArRows.length ? openArRows.map((g) => g.ar_age_days || 0).reduce((a, b) => a + b, 0) / openArRows.length : 0;

    return {
      totalPatients,
      totalClaims,
      uniqueTherapies,
      cleanClaimRate,
      initialDenialRate,
      firstPassResolutionRate,
      netCollectionRate,
      patientCollectionRate,
      zeroArClaims,
      avgChargeLag,
      openArDays,
    };
  }, [filtered, openArRows]);

  const buildSummary = (key) => {
    const totalCollections = filtered.reduce((s, g) => s + g.total_collections, 0) || 1;
    const map = new Map();
    filtered.forEach((g) => {
      const value = g[key] || "Unknown";
      if (!map.has(value)) {
        map.set(value, {
          value,
          claims: 0,
          patients: new Set(),
          collections: 0,
          denied: 0,
          openAr: 0,
        });
      }
      const item = map.get(value);
      item.claims += 1;
      item.patients.add(g.patient_id);
      item.collections += g.total_collections;
      item.denied += g.denial_rate_flag ? 1 : 0;
      item.openAr += g.current_ar_balance;
    });
    return Array.from(map.values()).map((x) => ({
      ...x,
      patients: x.patients.size,
      avgPerClaim: x.claims ? x.collections / x.claims : 0,
      share: x.collections / totalCollections,
      denialRate: x.claims ? x.denied / x.claims : 0,
    }));
  };

  const revenueByTherapyClass = useMemo(() => buildSummary("therapy_class"), [filtered]);
  const revenueByPayor = useMemo(() => buildSummary("payor"), [filtered]);
  const revenueByDrug = useMemo(() => buildSummary("drug_name"), [filtered]);

  const buildDenialSummary = (key) => {
    const totalClaims = filtered.length || 1;
    const map = new Map();
    filtered.forEach((g) => {
      const value = g[key] || "Unknown";
      if (!map.has(value)) {
        map.set(value, {
          value,
          totalClaims: 0,
          deniedClaims: 0,
          arAtRisk: 0,
          reasons: new Map(),
        });
      }
      const item = map.get(value);
      item.totalClaims += 1;
      if (g.denial_rate_flag) {
        item.deniedClaims += 1;
        item.arAtRisk += g.current_ar_balance;
        if (g.denial_reason) item.reasons.set(g.denial_reason, (item.reasons.get(g.denial_reason) || 0) + 1);
      }
    });
    return Array.from(map.values()).map((x) => ({
      value: x.value,
      totalClaims: x.totalClaims,
      deniedClaims: x.deniedClaims,
      denialRate: x.totalClaims ? x.deniedClaims / x.totalClaims : 0,
      claimShare: x.totalClaims / totalClaims,
      topReason: Array.from(x.reasons.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "",
      arAtRisk: x.arAtRisk,
    }));
  };

  const denialByPayor = useMemo(() => buildDenialSummary("payor"), [filtered]);
  const denialByTherapyClass = useMemo(() => buildDenialSummary("therapy_class"), [filtered]);
  const denialByDrug = useMemo(() => buildDenialSummary("drug_name"), [filtered]);

  const scatterData = useMemo(() => {
    const map = new Map();
    filtered.forEach((g) => {
      const value = g.drug_name || "Unknown";
      if (!map.has(value)) {
        map.set(value, {
          name: value,
          volume: 0,
          revenue: 0,
          denied: 0,
          therapyClass: g.therapy_class || "Unknown",
        });
      }
      const item = map.get(value);
      item.volume += 1;
      item.revenue += g.total_collections;
      item.denied += g.denial_rate_flag ? 1 : 0;
    });

    return Array.from(map.values())
      .map((x) => ({
        ...x,
        denialRate: x.volume ? x.denied / x.volume : 0,
        fill: colorForTherapyClass(x.therapyClass),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 40);
  }, [filtered]);

  const scatterLegendData = useMemo(() => {
    const seen = new Set();
    return scatterData
      .map((d) => d.therapyClass)
      .filter((therapyClass) => {
        if (seen.has(therapyClass)) return false;
        seen.add(therapyClass);
        return true;
      })
      .map((therapyClass) => ({
        value: therapyClass,
        type: "circle",
        color: colorForTherapyClass(therapyClass),
      }));
  }, [scatterData]);

  const emphasizedTherapyClass = hoveredTherapyClassLegend || activeTherapyClassLegend;

  const handleFile = (file) => {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = parseCsvRows(results.data || []);
        setLineRows(parsed);
        setFileName(file.name);
      },
    });
  };

  const toggleFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((x) => x !== value) : [...prev[key], value],
    }));
  };

  const handleSortChange = (setter) => (key) => {
    setter((prev) => ({ key, direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc" }));
  };

  const clearAll = () => {
    setFilters({ dateStart: "", dateEnd: "", payors: [], therapyClasses: [], drugNames: [], codes: [], denialReasons: [], claimStatuses: [] });
    setSelectedViz({ payor: null, therapyClass: null, drugName: null, denialReason: null, arBucket: null });
    setSearch("");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fbff_0%,_#f8fafc_38%,_#eef2ff_100%)] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-white/60 bg-white/90 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-500">
              <BarChart3 className="h-5 w-5" />
              <span className="text-sm font-medium">Home Infusion Revenue Cycle Dashboard</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">CSV in, executive-ready analytics out</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Upload a line-level claims CSV. The app aggregates to claim-group level, applies global filters, and connects every chart and table to the same master detail view.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-sm hover:bg-slate-800">
              <Upload className="h-4 w-4" />
              <span className="text-sm font-medium">Upload CSV</span>
              <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
            <Button variant="outline" className="rounded-2xl" onClick={clearAll}>Reset filters</Button>
          </div>
        </div>

        {fileName ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 hover:bg-emerald-100">Loaded: {fileName}</Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1">Line rows: {lineRows.length}</Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1">Claim groups: {claimGroups.length}</Badge>
          </div>
        ) : null}

        <Card className="rounded-[28px] border-0 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">Global Filters</CardTitle>
              <Button variant="outline" className="rounded-2xl" onClick={clearAll}>Remove all filters</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
              <div className="space-y-2 xl:col-span-2">
                <Label>Date of Service Start</Label>
                <Input type="date" value={filters.dateStart} onChange={(e) => setFilters((p) => ({ ...p, dateStart: e.target.value }))} className="rounded-xl border-slate-200 bg-white" />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label>Date of Service End</Label>
                <Input type="date" value={filters.dateEnd} onChange={(e) => setFilters((p) => ({ ...p, dateEnd: e.target.value }))} className="rounded-xl border-slate-200 bg-white" />
              </div>
              <div className="space-y-2 xl:col-span-4">
                <Label>Search</Label>
                <Input placeholder="Claim ID, drug, payor, denial reason..." value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-xl border-slate-200 bg-white" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MultiSelectFilter label="Payor" options={options.payors} selected={filters.payors} onToggle={(v) => toggleFilter("payors", v)} onClear={() => setFilters((p) => ({ ...p, payors: [] }))} />
              <MultiSelectFilter label="Therapy Class" options={options.therapyClasses} selected={filters.therapyClasses} onToggle={(v) => toggleFilter("therapyClasses", v)} onClear={() => setFilters((p) => ({ ...p, therapyClasses: [] }))} />
              <MultiSelectFilter label="Drug Name" options={options.drugNames} selected={filters.drugNames} onToggle={(v) => toggleFilter("drugNames", v)} onClear={() => setFilters((p) => ({ ...p, drugNames: [] }))} />
              <MultiSelectFilter label="Code" options={options.codes} selected={filters.codes} onToggle={(v) => toggleFilter("codes", v)} onClear={() => setFilters((p) => ({ ...p, codes: [] }))} />
              <MultiSelectFilter label="Denial Reason" options={options.denialReasons} selected={filters.denialReasons} onToggle={(v) => toggleFilter("denialReasons", v)} onClear={() => setFilters((p) => ({ ...p, denialReasons: [] }))} />
              <MultiSelectFilter label="Claim Status" options={options.claimStatuses} selected={filters.claimStatuses} onToggle={(v) => toggleFilter("claimStatuses", v)} onClear={() => setFilters((p) => ({ ...p, claimStatuses: [] }))} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Business Snapshot</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard title="Total Patients" value={kpis.totalPatients.toLocaleString()} icon={Users} accent="from-sky-500 to-blue-600" />
            <KpiCard title="Total Claims" value={kpis.totalClaims.toLocaleString()} icon={FileText} accent="from-violet-500 to-indigo-600" />
            <KpiCard title="Unique Therapies" value={kpis.uniqueTherapies.toLocaleString()} icon={Activity} accent="from-emerald-500 to-teal-600" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Revenue Cycle Performance</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Clean Claim Rate" value={percent(kpis.cleanClaimRate)} accent="from-blue-600 to-cyan-500" />
            <KpiCard title="Initial Denial Rate" value={percent(kpis.initialDenialRate)} accent="from-rose-500 to-red-600" />
            <KpiCard title="First Pass Resolution" value={percent(kpis.firstPassResolutionRate)} accent="from-indigo-500 to-violet-600" />
            <KpiCard title="Net Collection Rate" value={percent(kpis.netCollectionRate)} accent="from-emerald-500 to-green-600" />
            <KpiCard title="Patient Collection Rate" value={percent(kpis.patientCollectionRate)} accent="from-amber-500 to-orange-600" />
            <KpiCard title="$0 AR Claims" value={percent(kpis.zeroArClaims)} accent="from-slate-700 to-slate-900" />
            <KpiCard title="Avg Charge Lag" value={`${kpis.avgChargeLag.toFixed(1)} days`} accent="from-fuchsia-500 to-pink-600" />
            <KpiCard title="Days in AR (Open)" value={`${kpis.openArDays.toFixed(1)} days`} accent="from-teal-500 to-emerald-600" />
          </div>
        </div>

        <Card className="rounded-[28px] border-0 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-lg">Open AR Aging Mix</CardTitle>
              <div className="text-sm text-slate-500">Validation: {arValidation.openClaims} open claims · {currency.format(arValidation.totalAr)} total open AR</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <AgingBoxes rows={openArRows} activeBucket={selectedViz.arBucket} onSelectBucket={(bucket) => setSelectedViz((p) => ({ ...p, arBucket: bucket }))} />
            <div className="grid gap-3 md:grid-cols-5">
              {arValidation.buckets.map((b) => (
                <div key={b.bucket} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <div className="font-semibold text-slate-800">{b.bucket}</div>
                  <div>{b.claims} claims</div>
                  <div>{currency.format(b.dollars)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Revenue and Claim Counts</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="therapy">
              <TabsList className="grid w-full grid-cols-3 rounded-2xl bg-slate-100/80 p-1">
                <TabsTrigger value="therapy" className="rounded-xl">Therapy Class</TabsTrigger>
                <TabsTrigger value="payor" className="rounded-xl">Payor</TabsTrigger>
                <TabsTrigger value="drug" className="rounded-xl">Drug</TabsTrigger>
              </TabsList>
              <TabsContent value="therapy" className="mt-4">
                <SummaryTable rows={revenueByTherapyClass} dimensionKey="Therapy Class" activeValue={selectedViz.therapyClass} onSelect={(value) => setSelectedViz((p) => ({ ...p, therapyClass: value }))} sortConfig={summarySort} onSort={handleSortChange(setSummarySort)} />
              </TabsContent>
              <TabsContent value="payor" className="mt-4">
                <SummaryTable rows={revenueByPayor} dimensionKey="Payor" activeValue={selectedViz.payor} onSelect={(value) => setSelectedViz((p) => ({ ...p, payor: value }))} sortConfig={summarySort} onSort={handleSortChange(setSummarySort)} />
              </TabsContent>
              <TabsContent value="drug" className="mt-4">
                <SummaryTable rows={revenueByDrug} dimensionKey="Drug" activeValue={selectedViz.drugName} onSelect={(value) => setSelectedViz((p) => ({ ...p, drugName: value }))} sortConfig={summarySort} onSort={handleSortChange(setSummarySort)} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-0 bg-white/90 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Top Drugs by Volume vs Revenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[520px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis type="number" dataKey="volume" name="Claim Groups" tickLine={false} axisLine={false} label={{ value: "Claim groups containing drug", position: "insideBottom", offset: -10 }} />
                  <YAxis type="number" dataKey="revenue" name="Collections" tickFormatter={(v) => compactCurrency.format(v)} tickLine={false} axisLine={false} width={90} label={{ value: "Total collections", angle: -90, position: "insideLeft" }} />
                  
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const point = payload[0].payload;
                      return (
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                          <div className="font-semibold text-slate-900">{point.name}</div>
                          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: point.fill }} />
                            {point.therapyClass}
                          </div>
                          <div className="mt-3 space-y-1 text-sm">
                            <div>Volume: <span className="font-medium text-slate-900">{point.volume}</span></div>
                            <div>Collections: <span className="font-medium text-slate-900">{currency.format(point.revenue)}</span></div>
                            <div>Denial Rate: <span className="font-medium text-slate-900">{percent(point.denialRate)}</span></div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={scatterData}
                    onClick={(payload) => {
                      const clickedDrug = payload?.name || payload?.payload?.name || null;
                      setSelectedViz((p) => ({
                        ...p,
                        drugName: p.drugName === clickedDrug ? null : clickedDrug,
                      }));
                    }}
                  >
                    {scatterData.map((entry) => {
                      const legendMatch = emphasizedTherapyClass && entry.therapyClass === emphasizedTherapyClass;
                      const shouldFade = emphasizedTherapyClass && entry.therapyClass !== emphasizedTherapyClass;
                      const selectedDrug = selectedViz.drugName === entry.name;
                      return (
                        <Cell
                          key={entry.name}
                          fill={selectedDrug ? "#0f172a" : entry.fill}
                          stroke={legendMatch || selectedDrug ? "#0f172a" : entry.fill}
                          strokeWidth={legendMatch || selectedDrug ? 2.5 : 1}
                          fillOpacity={shouldFade ? 0.18 : legendMatch ? 1 : 0.92}
                          className="cursor-pointer"
                          style={legendMatch ? { filter: "drop-shadow(0 0 10px rgba(15,23,42,0.35))" } : undefined}
                        />
                      );
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Therapy class (hover or click to focus)</span>
              {scatterLegendData.map((item) => {
                const active = emphasizedTherapyClass === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onMouseEnter={() => setHoveredTherapyClassLegend(item.value)}
                    onMouseLeave={() => setHoveredTherapyClassLegend(null)}
                    onClick={() => setActiveTherapyClassLegend((prev) => (prev === item.value ? null : item.value))}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 transition ${active ? "border-slate-900 bg-white text-slate-900 shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-white/70"}`}
                  >
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: active ? `0 0 0 4px ${item.color}22` : undefined,
                      }}
                    />
                    <span>{item.value}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Denials Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="payor">
              <TabsList className="grid w-full grid-cols-3 rounded-2xl">
                <TabsTrigger value="payor">By Payor</TabsTrigger>
                <TabsTrigger value="therapy">By Therapy Class</TabsTrigger>
                <TabsTrigger value="drug">By Drug Name</TabsTrigger>
              </TabsList>
              <TabsContent value="payor" className="mt-4">
                <DenialTable rows={denialByPayor} activeValue={selectedViz.payor} onSelect={(value) => setSelectedViz((p) => ({ ...p, payor: value }))} sortConfig={denialSort} onSort={handleSortChange(setDenialSort)} />
              </TabsContent>
              <TabsContent value="therapy" className="mt-4">
                <DenialTable rows={denialByTherapyClass} activeValue={selectedViz.therapyClass} onSelect={(value) => setSelectedViz((p) => ({ ...p, therapyClass: value }))} sortConfig={denialSort} onSort={handleSortChange(setDenialSort)} />
              </TabsContent>
              <TabsContent value="drug" className="mt-4">
                <DenialTable rows={denialByDrug} activeValue={selectedViz.drugName} onSelect={(value) => setSelectedViz((p) => ({ ...p, drugName: value }))} sortConfig={denialSort} onSort={handleSortChange(setDenialSort)} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="rounded-3xl shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-lg">Master Detail Table</CardTitle>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedViz).map(([key, value]) =>
                  value ? (
                    <Badge key={key} variant="secondary" className="gap-1 rounded-full px-3 py-1">
                      {key}: {value}
                      <button onClick={() => setSelectedViz((p) => ({ ...p, [key]: null }))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DetailTable rows={filtered} sortConfig={detailSort} onSort={handleSortChange(setDetailSort)} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
