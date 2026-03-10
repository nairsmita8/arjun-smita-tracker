// src/App.jsx
import { useEffect, useState, useMemo } from "react";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs
} from "firebase/firestore";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  LabelList
} from "recharts";

import "./App.css";

const PEOPLE = ["Arjun", "Smita"];

const GOALS = [
  { key: "workout", label: "45 minutes workout" },
  { key: "steps", label: "8k steps" },
  { key: "water", label: "Water intake" },
  { key: "sleep", label: "7–8 hours of sleep" },
  { key: "reading", label: "Read 10 pages" }
];

async function getLast90Days(person) {
  const today = new Date();
  const start = new Date();
  start.setDate(today.getDate() - 89);

  const startStr = start.toISOString().slice(0, 10);

  const q = query(
    collection(db, "dailyGoals"),
    where("person", "==", person),
    where("date", ">=", startStr)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateStr(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // make Monday start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function App() {
  const [date, setDate] = useState(getTodayString());
  const [data, setData] = useState({ Arjun: {}, Smita: {} });
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState({
    Arjun: [],
    Smita: []
  });

  const [chartType, setChartType] = useState("line"); // 'line' | 'bar'

  // Load daily data for selected date
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const newData = {};

      for (const person of PEOPLE) {
        const id = `${person}_${date}`;
        const ref = doc(collection(db, "dailyGoals"), id);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          newData[person] = snap.data().goals;
        } else {
          const defaultGoals = {};
          GOALS.forEach((g) => (defaultGoals[g.key] = false));
          newData[person] = defaultGoals;
        }
      }

      setData(newData);
      setLoading(false);
    };

    load();
  }, [date]);

  // Load 90‑day history for graph and analytics
  useEffect(() => {
    const loadHistory = async () => {
      const result = {};

      for (const person of PEOPLE) {
        const days = await getLast90Days(person);

        const formatted = days.map((d) => {
          const completed = GOALS.filter((g) => d.goals[g.key]).length;
          return { date: d.date, completed };
        });

        result[person] = formatted;
      }

      setHistory(result);
    };

    loadHistory();
  }, []);

  // 90‑day per‑day graph data
  const graphData = useMemo(() => {
    const allDates = new Set([
      ...history.Arjun.map((d) => d.date),
      ...history.Smita.map((d) => d.date)
    ]);

    const sortedDates = [...allDates].sort();
    return sortedDates.map((date) => ({
      date,
      Arjun: history.Arjun.find((d) => d.date === date)?.completed || 0,
      Smita: history.Smita.find((d) => d.date === date)?.completed || 0
    }));
  }, [history]);

  // Weekly averages stacked data
  const weeklyData = useMemo(() => {
    const weeks = new Map();

    for (const person of PEOPLE) {
      for (const day of history[person]) {
        const dt = parseDateStr(day.date);
        const weekStart = getWeekStart(dt);
        const key = weekStart.toISOString().slice(0, 10);

        if (!weeks.has(key)) {
          weeks.set(key, {
            weekStart,
            ArjunSum: 0,
            ArjunCount: 0,
            SmitaSum: 0,
            SmitaCount: 0
          });
        }

        const w = weeks.get(key);
        if (person === "Arjun") {
          w.ArjunSum += day.completed;
          w.ArjunCount += 1;
        } else {
          w.SmitaSum += day.completed;
          w.SmitaCount += 1;
        }
      }
    }

    const arr = Array.from(weeks.values()).sort(
      (a, b) => a.weekStart - b.weekStart
    );

    return arr.map((w) => {
      const arjunAvg = w.ArjunCount ? w.ArjunSum / w.ArjunCount : 0;
      const smitaAvg = w.SmitaCount ? w.SmitaSum / w.SmitaCount : 0;

      let bottomValue, topValue, bottomPerson, topPerson;
      if (arjunAvg >= smitaAvg) {
        bottomValue = smitaAvg;
        topValue = arjunAvg - smitaAvg;
        bottomPerson = "Smita";
        topPerson = "Arjun";
      } else {
        bottomValue = arjunAvg;
        topValue = smitaAvg - arjunAvg;
        bottomPerson = "Arjun";
        topPerson = "Smita";
      }

      return {
        weekLabel: formatWeekLabel(w.weekStart),
        bottomValue,
        topValue,
        bottomPerson,
        topPerson,
        arjunAvg,
        smitaAvg
      };
    });
  }, [history]);

  // Streaks and perfect‑day stats
  const streaksAndPerfectDays = useMemo(() => {
    const result = {};

    for (const person of PEOPLE) {
      const days = [...history[person]].sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      let currentStreak = 0;
      let longestStreak = 0;
      let perfectDays = 0;

      let prevDate = null;

      for (const day of days) {
        const isPerfect = day.completed === GOALS.length;
        if (isPerfect) {
          perfectDays += 1;
        }

        const dt = parseDateStr(day.date);

        if (isPerfect) {
          if (prevDate) {
            const diff =
              (dt.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
            if (diff === 1) {
              currentStreak += 1;
            } else {
              currentStreak = 1;
            }
          } else {
            currentStreak = 1;
          }
        } else {
          currentStreak = 0;
        }

        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }

        prevDate = dt;
      }

      result[person] = { currentStreak, longestStreak, perfectDays };
    }

    return result;
  }, [history]);

  const handleToggle = async (person, goalKey) => {
    const personGoals = data[person] || {};
    const updatedGoals = {
      ...personGoals,
      [goalKey]: !personGoals[goalKey]
    };

    setData((prev) => ({
      ...prev,
      [person]: updatedGoals
    }));

    const id = `${person}_${date}`;
    const ref = doc(collection(db, "dailyGoals"), id);
    await setDoc(ref, {
      person,
      date,
      goals: updatedGoals
    });
  };

  const getProgress = (person) => {
    const goals = data[person] || {};
    const total = GOALS.length;
    const completed = GOALS.filter((g) => goals[g.key]).length;
    return {
      completed,
      total,
      percent: Math.round((completed / total) * 100),
      anyMissing: completed < total
    };
  };

  const scoreboard = useMemo(() => {
    const a = streaksAndPerfectDays.Arjun?.perfectDays || 0;
    const s = streaksAndPerfectDays.Smita?.perfectDays || 0;

    let winner = null;
    if (a > s) winner = "Arjun";
    else if (s > a) winner = "Smita";

    return { arjunPerfect: a, smitaPerfect: s, winner };
  }, [streaksAndPerfectDays]);

  return (
    <div className="app">
      <h1>Daily Goals Tracker – Arjun &amp; Smita</h1>

      {/* Date picker */}
      <div className="date-picker">
        <label>
          <span>Date: </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {/* Daily cards */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="people-container">
          {PEOPLE.map((person) => {
            const progress = getProgress(person);
            const streak = streaksAndPerfectDays[person] || {
              currentStreak: 0,
              longestStreak: 0
            };

            return (
              <div key={person} className="person-card">
                <h2>{person}</h2>

                <div className="progress-bar-wrapper">
                  <div className="progress-label">
                    {progress.completed}/{progress.total} goals
                  </div>
                  <div className="progress-bar">
                    <div
                      className={
                        "progress-fill " +
                        (progress.anyMissing
                          ? "progress-red"
                          : "progress-green")
                      }
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>

                <div className="goals-list">
                  {GOALS.map((goal) => {
                    const checked = data[person]?.[goal.key] || false;
                    return (
                      <label
                        key={goal.key}
                        className={
                          "goal-item " +
                          (!checked ? "goal-missing" : "goal-ok")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggle(person, goal.key)}
                        />
                        <span>{goal.label}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="streak-info">
                  <p>
                    <strong>Current streak:</strong> {streak.currentStreak}{" "}
                    day{streak.currentStreak === 1 ? "" : "s"}
                  </p>
                  <p>
                    <strong>Longest streak:</strong> {streak.longestStreak}{" "}
                    day{streak.longestStreak === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Scoreboard */}
      <div style={{ marginTop: "30px", marginBottom: "20px" }}>
        <h2>Perfect Day Scoreboard (Last 90 Days)</h2>
        {scoreboard.winner ? (
          <p style={{ fontSize: "1.1rem" }}>
            🏆 <strong>{scoreboard.winner}</strong> is ahead with the most
            perfect days!
          </p>
        ) : (
          <p style={{ fontSize: "1.1rem" }}>
            It&apos;s a tie! Both are crushing it.
          </p>
        )}
        <p>
          Arjun: <strong>{scoreboard.arjunPerfect}</strong> perfect days
        </p>
        <p>
          Smita: <strong>{scoreboard.smitaPerfect}</strong> perfect days
        </p>
      </div>

      {/* 90‑Day Progress Chart with toggle */}
      <div style={{ marginTop: "20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "10px"
          }}
        >
          <h2 style={{ margin: 0 }}>90‑Day Progress</h2>
          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={() => setChartType("line")}
              style={{
                marginRight: "8px",
                padding: "4px 10px",
                fontWeight: chartType === "line" ? "bold" : "normal"
              }}
            >
              Line Chart
            </button>
            <button
              onClick={() => setChartType("bar")}
              style={{
                padding: "4px 10px",
                fontWeight: chartType === "bar" ? "bold" : "normal"
              }}
            >
              Bar Chart
            </button>
          </div>
        </div>

        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            {chartType === "line" ? (
              <LineChart data={graphData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, GOALS.length]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Arjun"
                  stroke="#007bff"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="Smita"
                  stroke="#ff4081"
                  strokeWidth={2}
                />
              </LineChart>
            ) : (
              <BarChart data={graphData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, GOALS.length]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Arjun" fill="#007bff" />
                <Bar dataKey="Smita" fill="#ff4081" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Averages Stacked Chart */}
      <div style={{ marginTop: "40px" }}>
        <h2>Weekly Average Goals (Stacked)</h2>
        <p style={{ fontSize: "0.9rem", marginBottom: "8px" }}>
          Each bar shows the combined average goals per week. The top segment
          belongs to whoever did better that week. Labels inside show who is who
          and their average.
        </p>

        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={weeklyData} stackOffset="none">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="weekLabel" />
              <YAxis domain={[0, GOALS.length]} />
              <Tooltip
                formatter={(value, name, props) => {
                  if (name === "bottomValue") {
                    return [
                      value.toFixed(2),
                      props.payload.bottomPerson + " avg"
                    ];
                  }
                  if (name === "topValue") {
                    return [value.toFixed(2), props.payload.topPerson + " extra"];
                  }
                  return value;
                }}
              />
              <Legend
                formatter={(value) =>
                  value === "bottomValue" ? "Bottom segment" : "Top segment"
                }
              />
              <Bar dataKey="bottomValue" stackId="avg" fill="#90caf9">
                <LabelList
                  dataKey="bottomValue"
                  position="inside"
                  formatter={(v, entry) =>
                    v > 0
                      ? `${entry.bottomPerson} ${v.toFixed(1)}`
                      : ""
                  }
                  style={{ fontSize: 10 }}
                />
              </Bar>
              <Bar dataKey="topValue" stackId="avg" fill="#f48fb1">
                <LabelList
                  dataKey="topValue"
                  position="inside"
                  formatter={(v, entry) =>
                    v > 0 ? `${entry.topPerson} ${(entry.bottomValue + v).toFixed(1)}` : ""
                  }
                  style={{ fontSize: 10 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default App;
