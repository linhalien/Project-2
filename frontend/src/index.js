// index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "react-oidc-context";

// Cấu hình chìa khóa kết nối với Cognito
const cognitoAuthConfig = {
  authority: process.env.REACT_APP_COGNITO_DOMAIN,
  client_id: process.env.REACT_APP_CLIENT_ID,
  redirect_uri: process.env.REACT_APP_REDIRECT_URI,
  response_type: "code", // chuẩn OAuth 2.0 - sử dụng Authorization Code Flow
  scope: "email openid phone",
}; 

const root = ReactDOM.createRoot(document.getElementById("root"));

// wrap the application with AuthProvider
root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <App />
    </AuthProvider>
  </React.StrictMode>
);