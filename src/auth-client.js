import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient({
  baseURL: "https://bcknd.fly.dev/api/v1/auth",
  fetchOptions: {
    onRequest: (context) => {
      console.log("Auth request:", context);
      return context;
    },
    onResponse: (context) => {
      console.log("Auth response:", context);
      return context;
    },
  },
});