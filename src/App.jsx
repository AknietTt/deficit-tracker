import React, { useEffect, useMemo, useRef, useState } from "react";
import { Flame, TrendingDown, Settings2, Info, Calculator, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { storage } from "./storage";

const COLORS = {
  ink900: "#17191B",
  ink800: "#202226",
  ink700: "#2A2D31",
  ink600: "#383B40",
  paper: "#ECE7DC",
  paperMuted: "#9C978C",
  ember: "#E8763F",
  moss: "#7A9B72",
  rust: "#C15C4E",
};

const ACTIVITY_OPTIONS = [
  { value: 1.2, label: "Минимум движения (сидячая работа)" },
  { value: 1.375, label: "Лёгкая активность (5-7к шагов)" },
  { value: 1.45, label: "10к шагов в день" },
  { value: 1.55, label: "10к шагов + тренировки 2-3р/нед" },
  { value: 1.725, label: "Активные тренировки 5-6р/нед" },
];

const MONTH_NAMES = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

const DEFAULT_SETTINGS = {
  weight: 110,
  goalWeight: 80,
  height: 180,
  age: 22,
  activity: 1.45,
  dailyDeficitTarget: 650,
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

function polar(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

function arcPath(cx, cy, r, fromAngle, toAngle) {
  const p1 = polar(cx, cy, r, fromAngle);
  const p2 = polar(cx, cy, r, toAngle);
  const largeArc = fromAngle - toAngle > 180 ? 1 : 0;
  return "M " + p1.x + " " + p1.y + " A " + r + " " + r + " 0 " + largeArc + " 1 " + p2.x + " " + p2.y;
}

function calcBMR(weight, height, age) {
  return 10 * weight + 6.25 * height - 5 * age + 5;
}

function daysInMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function monthKey(year, monthIdx) {
  return "days-" + year + "-" + String(monthIdx + 1).padStart(2, "0");
}

export default function MonthlyDeficitTracker() {
  const today = new Date();
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [days, setDays] = useState([]);
  const [showSettings, setShowSettings] = useState(true);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");

  const settingsTimer = useRef(null);
  const daysTimer = useRef(null);
  const skipNextDaysSave = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("settings", false);
        if (res && res.value) setSettings(JSON.parse(res.value));
      } catch (e) {
        // no saved settings yet, keep defaults
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const dim = daysInMonth(current.year, current.month);
    skipNextDaysSave.current = true;
    (async () => {
      try {
        const res = await storage.get(monthKey(current.year, current.month), false);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          setDays(parsed.length === dim ? parsed : Array(dim).fill(""));
        } else {
          setDays(Array(dim).fill(""));
        }
      } catch (e) {
        setDays(Array(dim).fill(""));
      }
    })();
  }, [current]);

  useEffect(() => {
    if (!ready) return;
    if (settingsTimer.current) clearTimeout(settingsTimer.current);
    settingsTimer.current = setTimeout(async () => {
      try {
        setStatus("Сохраняю...");
        await storage.set("settings", JSON.stringify(settings), false);
        setStatus("Сохранено");
        setTimeout(() => setStatus(""), 1200);
      } catch (e) {
        setStatus("Не удалось сохранить");
      }
    }, 500);
    return () => clearTimeout(settingsTimer.current);
  }, [settings, ready]);

  useEffect(() => {
    if (skipNextDaysSave.current) {
      skipNextDaysSave.current = false;
      return;
    }
    if (days.length === 0) return;
    if (daysTimer.current) clearTimeout(daysTimer.current);
    daysTimer.current = setTimeout(async () => {
      try {
        setStatus("Сохраняю...");
        await storage.set(monthKey(current.year, current.month), JSON.stringify(days), false);
        setStatus("Сохранено");
        setTimeout(() => setStatus(""), 1200);
      } catch (e) {
        setStatus("Не удалось сохранить");
      }
    }, 500);
    return () => clearTimeout(daysTimer.current);
  }, [days, current]);

  const updateSetting = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const { weight, goalWeight, height, age, activity, dailyDeficitTarget } = settings;
  const bmr = calcBMR(weight, height, age);
  const tdee = Math.round(bmr * activity);
  const targetDailyIntake = Math.max(Math.round(tdee - dailyDeficitTarget), 1500);
  const actualDailyDeficit = tdee - targetDailyIntake;
  const dim = daysInMonth(current.year, current.month);
  const targetMonthlyDeficit = actualDailyDeficit * dim;

  const { totalDeficit, totalConsumed, filledCount } = useMemo(() => {
    let total = 0;
    let consumed = 0;
    let count = 0;
    days.forEach((v) => {
      const n = parseFloat(v);
      if (!isNaN(n) && v !== "") {
        total += tdee - n;
        consumed += n;
        count += 1;
      }
    });
    return { totalDeficit: total, totalConsumed: consumed, filledCount: count };
  }, [days, tdee]);

  const monthlyIntakeBudget = targetDailyIntake * dim;
  const monthlyMaintenance = tdee * dim;

  const monthKg = totalDeficit / 7700;
  const progress = targetMonthlyDeficit > 0 ? totalDeficit / targetMonthlyDeficit : 0;
  const progressClamped = Math.max(0, Math.min(progress, 1));

  const avgDailyDeficit = filledCount > 0 ? totalDeficit / filledCount : 0;
  const projectedMonthlyKg = (avgDailyDeficit * 30) / 7700;
  const kgToGoal = weight - goalWeight;
  const monthsToGoal =
    filledCount > 0 && projectedMonthlyKg > 0 ? kgToGoal / projectedMonthlyKg : null;

  const updateDay = (idx, value) => {
    const next = [...days];
    next[idx] = value;
    setDays(next);
  };

  const goMonth = (delta) => {
    setCurrent((c) => {
      let m = c.month + delta;
      let y = c.year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return { year: y, month: m };
    });
  };

  const clearMonth = async () => {
    const empty = Array(dim).fill("");
    setDays(empty);
    try {
      await storage.set(monthKey(current.year, current.month), JSON.stringify(empty), false);
    } catch (e) {}
  };

  const cx = 150, cy = 150, r = 118;
  const startAngle = 180, endAngle = 0;
  const progressAngle = startAngle - progressClamped * 180;

  return (
    <div
      style={{
        background: COLORS.ink900,
        color: COLORS.paper,
        fontFamily: "'Inter', sans-serif",
        borderRadius: 16,
        padding: "1.75rem",
        maxWidth: 720,
        margin: "0 auto",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .mdt-input::placeholder { color: ${COLORS.paperMuted}; opacity: 0.6; }
        .mdt-num { font-family: 'JetBrains Mono', monospace; }
        .mdt-disp { font-family: 'Oswald', sans-serif; }
        .mdt-input:focus { outline: none; border-color: ${COLORS.ember} !important; }
        .mdt-select { width: 100%; margin-top: 4px; background: ${COLORS.ink900}; border: 0.5px solid ${COLORS.ink600}; border-radius: 6px; color: ${COLORS.paper}; font-size: 13px; padding: 6px 8px; }
        .mdt-slider { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; background: ${COLORS.ink600}; }
        .mdt-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: ${COLORS.ember}; cursor: pointer; }
        .mdt-slider::-moz-range-thumb { width: 16px; height: 16px; border: none; border-radius: 50%; background: ${COLORS.ember}; cursor: pointer; }
        .mdt-iconbtn { background: transparent; border: 0.5px solid ${COLORS.ink600}; border-radius: 8px; padding: 6px; color: ${COLORS.paperMuted}; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Flame size={16} color={COLORS.ember} />
            <span style={{ fontSize: 12, letterSpacing: "0.14em", color: COLORS.paperMuted, textTransform: "uppercase" }}>
              Месячный дефицит
            </span>
            {status && <span style={{ fontSize: 11, color: COLORS.paperMuted }}>{"\u00b7 " + status}</span>}
          </div>
          <h1 className="mdt-disp" style={{ fontSize: 28, fontWeight: 600, margin: 0, letterSpacing: "0.01em" }}>
            {weight} кг {"\u2192"} {goalWeight} кг
          </h1>
        </div>
        <button onClick={() => setShowSettings((s) => !s)} aria-label="Настройки" className="mdt-iconbtn">
          <Settings2 size={16} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <button onClick={() => goMonth(-1)} aria-label="Предыдущий месяц" className="mdt-iconbtn">
          <ChevronLeft size={16} />
        </button>
        <span className="mdt-disp" style={{ fontSize: 15, fontWeight: 500 }}>
          {MONTH_NAMES[current.month]} {current.year}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={clearMonth} aria-label="Очистить месяц" className="mdt-iconbtn">
            <Trash2 size={15} />
          </button>
          <button onClick={() => goMonth(1)} aria-label="Следующий месяц" className="mdt-iconbtn">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div style={{ background: COLORS.ink800, border: "0.5px solid " + COLORS.ink700, borderRadius: 12, padding: "1rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: "0.1em", color: COLORS.paperMuted, textTransform: "uppercase", marginBottom: 12 }}>
            <Calculator size={13} />
            Калькулятор нормы
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
            <Field label="Текущий вес, кг">
              <input className="mdt-input mdt-num" type="number" value={weight}
                onChange={(e) => updateSetting("weight", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </Field>
            <Field label="Цель, кг">
              <input className="mdt-input mdt-num" type="number" value={goalWeight}
                onChange={(e) => updateSetting("goalWeight", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </Field>
            <Field label="Рост, см">
              <input className="mdt-input mdt-num" type="number" value={height}
                onChange={(e) => updateSetting("height", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </Field>
            <Field label="Возраст">
              <input className="mdt-input mdt-num" type="number" value={age}
                onChange={(e) => updateSetting("age", parseFloat(e.target.value) || 0)} style={inputStyle} />
            </Field>
          </div>

          <Field label="Активность">
            <select className="mdt-select" value={activity} onChange={(e) => updateSetting("activity", parseFloat(e.target.value))}>
              {ACTIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} style={{ background: COLORS.ink900 }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ marginTop: 14 }}>
            <Field label={"Дефицит в день: " + dailyDeficitTarget + " ккал"}>
              <input className="mdt-slider" type="range" min="300" max="1000" step="50"
                value={dailyDeficitTarget}
                onChange={(e) => updateSetting("dailyDeficitTarget", parseFloat(e.target.value))}
                style={{ width: "100%", marginTop: 12 }} />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, marginTop: 14 }}>
            <div style={{ background: COLORS.ink900, border: "0.5px solid " + COLORS.ink700, borderRadius: 8, padding: "0.6rem 0.75rem" }}>
              <div style={{ fontSize: 11, color: COLORS.paperMuted }}>Твоя норма (TDEE)</div>
              <div className="mdt-num" style={{ fontSize: 16, color: COLORS.paper, marginTop: 2 }}>{tdee} ккал</div>
            </div>
            <div style={{ background: hexToRgba(COLORS.ember, 0.12), border: "0.5px solid " + COLORS.ember, borderRadius: 8, padding: "0.6rem 0.75rem" }}>
              <div style={{ fontSize: 11, color: COLORS.paperMuted }}>Есть в день</div>
              <div className="mdt-num" style={{ fontSize: 16, color: COLORS.ember, marginTop: 2 }}>{targetDailyIntake} ккал</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11, color: COLORS.paperMuted, paddingTop: 10, lineHeight: 1.5 }}>
            <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            Пересчитывай вес и норму каждые 8-10 кг {"\u2014"} TDEE падает вместе с весом. Всё сохраняется автоматически.
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
        <svg width="300" height="170" viewBox="0 0 300 170">
          <path d={arcPath(cx, cy, r, startAngle, endAngle)} fill="none" stroke={COLORS.ink700} strokeWidth="14" strokeLinecap="round" />
          {progressClamped > 0 && (
            <path d={arcPath(cx, cy, r, startAngle, progressAngle)} fill="none"
              stroke={progress >= 0 ? COLORS.ember : COLORS.rust} strokeWidth="14" strokeLinecap="round" />
          )}
          <text x={cx} y={cy - 28} textAnchor="middle" className="mdt-disp" style={{ fontSize: 30, fontWeight: 600, fill: COLORS.paper }}>
            {monthKg >= 0 ? "-" : "+"}{Math.abs(monthKg).toFixed(1)} кг
          </text>
          <text x={cx} y={cy - 6} textAnchor="middle" style={{ fontSize: 12, fill: COLORS.paperMuted }}>
            за этот месяц
          </text>
          <text x={cx} y={cy + 20} textAnchor="middle" className="mdt-num" style={{ fontSize: 12, fill: COLORS.paperMuted }}>
            {Math.round(totalConsumed).toLocaleString("ru-RU")} / {Math.round(monthlyIntakeBudget).toLocaleString("ru-RU")} ккал съедено
          </text>
        </svg>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, marginBottom: "1.5rem" }}>
        <StatCard label={"Дней заполнено"} value={filledCount + " / " + dim} />
        <StatCard label="Прогноз до цели" value={monthsToGoal ? "~" + monthsToGoal.toFixed(1) + " мес." : "\u2014"}
          icon={<TrendingDown size={14} color={COLORS.moss} />} />
        <StatCard label="Бюджет на месяц"
          value={Math.round(totalConsumed).toLocaleString("ru-RU") + " / " + Math.round(monthlyIntakeBudget).toLocaleString("ru-RU")} />
        <StatCard label="Поддержание веса (мес.)" value={Math.round(monthlyMaintenance).toLocaleString("ru-RU") + " ккал"} />
      </div>

      <div style={{ marginBottom: "0.75rem", fontSize: 12, letterSpacing: "0.1em", color: COLORS.paperMuted, textTransform: "uppercase" }}>
        Дневник питания
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6 }}>
        {days.map((val, idx) => {
          const n = parseFloat(val);
          const hasValue = val !== "" && !isNaN(n);
          const deficit = hasValue ? tdee - n : null;
          const good = hasValue && deficit >= 0;
          const bad = hasValue && deficit < 0;
          const borderColor = good ? COLORS.moss : bad ? COLORS.rust : COLORS.ink700;
          const bgColor = good ? hexToRgba(COLORS.moss, 0.12) : bad ? hexToRgba(COLORS.rust, 0.12) : COLORS.ink800;
          return (
            <div key={idx} style={{ border: "0.5px solid " + borderColor, background: bgColor, borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: COLORS.paperMuted, marginBottom: 3 }}>{idx + 1}</div>
              <input className="mdt-input mdt-num" type="number" placeholder={"\u2014"} value={val}
                onChange={(e) => updateDay(idx, e.target.value)}
                style={{ width: "100%", background: "transparent", border: "none", color: COLORS.paper, fontSize: 12, textAlign: "center", padding: 0 }} />
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 11, color: COLORS.paperMuted, marginTop: "1.25rem", marginBottom: 0, lineHeight: 1.6 }}>
        1 кг жира {"\u2248"} 7700 ккал. Норма считается по формуле Миффлина-Сан Жеора. Данные хранятся локально в этом артефакте и видны только тебе. Ориентировочный расчёт, не медицинская рекомендация.
      </p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: COLORS.paperMuted }}>{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div style={{ background: COLORS.ink800, border: "0.5px solid " + COLORS.ink700, borderRadius: 12, padding: "0.9rem 1rem" }}>
      <div style={{ fontSize: 11, color: COLORS.paperMuted, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        {label}
      </div>
      <div className="mdt-disp" style={{ fontSize: 20, fontWeight: 600, color: COLORS.paper }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  marginTop: 4,
  background: COLORS.ink900,
  border: "0.5px solid " + COLORS.ink600,
  borderRadius: 6,
  color: COLORS.paper,
  fontSize: 13,
  padding: "6px 8px",
};
