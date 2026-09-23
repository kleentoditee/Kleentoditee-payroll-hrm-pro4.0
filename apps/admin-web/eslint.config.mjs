import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: [".next/**", "next-env.d.ts"] },
  ...nextCoreWebVitals,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off"
    }
  }
];

export default eslintConfig;
