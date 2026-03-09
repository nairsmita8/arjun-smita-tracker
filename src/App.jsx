// src/App.jsx
import { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import "./App.css";

const PEOPLE = ["Arjun", "Smita"];

const GOALS = [
  { key: "workout", label: "45 minutes workout" },
  { key: "steps", label: "8k steps" },
  { key: "water", label: "Water intake" },
  { key: "sleep", label: "7–8 hours of sleep" },
  { key: "reading", label: "Read 10 pages" },
];

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function App() {
  const [date, setDate] = useState(getTodayString());
  const [data, setData] = useState({
    Arjun: {},
    Smita: {},
  });
  const [loading, setLoading] = useState(false);

  // Load data for both people for selected date
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
          // default: all false
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

  const handleToggle = async (person, goalKey) => {
    const personGoals = data[person] || {};
    const updatedGoals = {
      ...personGoals,
      [goalKey]: !personGoals[goalKey],
    };

    setData((prev) => ({
      ...prev,
      [person]: updatedGoals,
    }));

    const id = `${person}_${date}`;
    const ref = doc(collection(db, "dailyGoals"), id);
    await setDoc(ref, {
      person,
      date,
      goals: updatedGoals,
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
      anyMissing: completed < total,
    };
  };

  return (
    <div className="app">
      <h1>Daily Goals Tracker – Arjun &amp; Smita</h1>

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

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="people-container">
          {PEOPLE.map((person) => {
            const progress = getProgress(person);
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
                        (progress.anyMissing ? "progress-red" : "progress-green")
                      }
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>

                <div className="goals-list">
                  {GOALS.map((goal) => {
                    const checked = data[person]?.[goal.key] || false;
                    const goalMissing = !checked;
                    return (
                      <label
                        key={goal.key}
                        className={
                          "goal-item " +
                          (goalMissing ? "goal-missing" : "goal-ok")
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default App;
