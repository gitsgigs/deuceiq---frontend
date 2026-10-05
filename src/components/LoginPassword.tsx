import { useId, useState } from "react";
import type { InputHTMLAttributes } from "react";
import "./LoginPassword.css";

export function LoginPassword(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return <div className="login-password-control">
    <input {...props} id={id} type={visible ? "text" : "password"} aria-label="Password" />
    <button type="button" aria-controls={id} aria-pressed={visible}
      aria-label={visible ? "Hide password" : "Show password"}
      onClick={() => setVisible(value => !value)}>{visible ? "Hide" : "Show"}</button>
  </div>;
}
