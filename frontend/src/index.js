// index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "react-oidc-context";

// Cấu hình key kết nối với Cognito
const cognitoAuthConfig = {
  authority: process.env.REACT_APP_COGNITO_DOMAIN,
  client_id: process.env.REACT_APP_CLIENT_ID, // App Client ID của User Pool App Client
  redirect_uri: process.env.REACT_APP_REDIRECT_URI,
  response_type: "code", // OAuth 2.0 (Authorization Code Flow)
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