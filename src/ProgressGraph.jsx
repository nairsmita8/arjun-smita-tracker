import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function ProgressGraph({ data, person }) {
  return (
    <div style={{ marginTop: "40px" }}>
      <h3>{person} – Last 90 Days Progress</h3>
      <LineChart width={600} height={300} data={data}>
        <CartesianGrid stroke="#ccc" />
        <XAxis dataKey="date" hide />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="completed" stroke="#4CAF50" strokeWidth={2} />
      </LineChart>
    </div>
  );
}
