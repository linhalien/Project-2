// index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "react-oidc-context";

// Cấu hình chìa khóa kết nối với Cognito
const cognitoAuthConfig = {
  authority: "https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_2cuzm4vfB",
  client_id: "766sg6l71idhfs4cap2n9vfi9c",
  redirect_uri: "http://localhost:5500",
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