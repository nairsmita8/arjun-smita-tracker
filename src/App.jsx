import React, { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
} from "firebase/firestore";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";

import "./App.css";

const PEOPLE = ["Arjun", "Smita"];

/* Added healthyFood here */
const GOALS = ["workout", "steps", "water", "sleep", "reading", "healthyFood"];

/* -----------------------------------------
   FIX: LOCAL TIMEZONE DATE HANDLING
------------------------------------------*/
function getLocalDateString(dateObj = new Date()) {
  const d = new Date(dateObj);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [history, setHistory] = useState({});
  const [graphData, setGraphData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);

  /* -----------------------------------------
     LOAD DATA WHEN DATE CHANGES
  ------------------------------------------*/
  useEffect(() => {
    loadDailyData();
    loadGraphData();
    loadWeeklyData();
  }, [selectedDate]);

  /* -----------------------------------------
     LOAD DAILY GOALS FOR SELECTED DATE
  ------------------------------------------*/
  async function loadDailyData() {
    const result = {};

    for (const person of PEOPLE) {
      const q = query(
        collection(db, "dailyGoals"),
        where("person", "==", person),
        where("date", "==", selectedDate)
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        result[person] = snap.docs[0].data().goals;
      } else {
        /* Added healthyFood default here */
        result[person] = {
          workout: false,
          steps: false,
          water: false,
          sleep: false,
          reading: false,
          healthyFood: false,
        };
      }
    }

    setHistory(result);
  }

  /* -----------------------------------------
     SAVE GOAL TO FIRESTORE
  ------------------------------------------*/
  async function toggleGoal(person, goal) {
    const updated = { ...history };
    updated[person][goal] = !updated[person][goal];
    setHistory(updated);

    const id = `${person}_${selectedDate}`;

    await setDoc(doc(db, "dailyGoals", id), {
      person,
      date: selectedDate,
      goals: updated[person],
    });
  }

  /* -----------------------------------------
     LOAD LINE CHART (NEXT 90 DAYS)
  ------------------------------------------*/
  async function loadGraphData() {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    end.setDate(end.getDate() + 90);

    const startStr = getLocalDateString(start);
    const endStr = getLocalDateString(end);

    const q = query(
      collection(db, "dailyGoals"),
      where("date", ">=", startStr),
      where("date", "<=", endStr)
    );

    const snap = await getDocs(q);
    const raw = snap.docs.map((d) => d.data());

    const grouped = {};

    raw.forEach((entry) => {
      if (!grouped[entry.date]) {
        grouped[entry.date] = { date: entry.date, Arjun: 0, Smita: 0 };
      }

      /* healthyFood automatically included because we count all true values */
      const count = Object.values(entry.goals).filter(Boolean).length;
      grouped[entry.date][entry.person] = count;
    });

    const sorted = Object.values(grouped).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    setGraphData(sorted);
  }

  /* -----------------------------------------
     LOAD WEEKLY STACKED BAR (NEXT 90 DAYS)
  ------------------------------------------*/
  async function loadWeeklyData() {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    end.setDate(end.getDate() + 90);

    const startStr = getLocalDateString(start);
    const endStr = getLocalDateString(end);

    const q = query(
      collection(db, "dailyGoals"),
      where("date", ">=", startStr),
      where("date", "<=", endStr)
    );

    const snap = await getDocs(q);
    const raw = snap.docs.map((d) => d.data());

    const weekly = {};

    raw.forEach((entry) => {
      const week = entry.date.slice(0, 7);
      if (!weekly[week]) weekly[week] = { week, Arjun: 0, Smita: 0 };

      const count = Object.values(entry.goals).filter(Boolean).length;
      weekly[week][entry.person] += count;
    });

    setWeeklyData(Object.values(weekly));
  }

  /* -----------------------------------------
     RENDER UI
  ------------------------------------------*/
  return (
    <div className="app">
      <h1>Daily Goal Tracker</h1>

      <div className="date-picker">
        <label>
          <span>Select Date: </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </label>
      </div>

      <div className="people-container">
        {PEOPLE.map((person) => (
          <div key={person} className="person-card">
            <h2>{person}</h2>

            <div className="goals-list">
              {GOALS.map((goal) => (
                <div
                  key={goal}
                  className={`goal-item ${
                    history[person]?.[goal] ? "goal-ok" : "goal-missing"
                  }`}
                  onClick={() => toggleGoal(person, goal)}
                >
                  <input
                    type="checkbox"
                    checked={history[person]?.[goal] || false}
                    readOnly
                  />
                  <span>
                    {goal === "healthyFood" ? "healthy food" : goal}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <h2 className="chart-title">Next 90 Days Progress</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={graphData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line dataKey="Arjun" stroke="#007bff" />
            <Line dataKey="Smita" stroke="#e74c3c" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h2 className="chart-title">Weekly Totals (Next 90 Days)</h2>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Arjun" stackId="a" fill="#007bff" />
            <Bar dataKey="Smita" stackId="a" fill="#e74c3c" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
