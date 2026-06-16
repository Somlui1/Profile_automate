# Provisioning Hub

A full-stack web application designed for automating user account provisioning, Active Directory management, and IT operations, built with React, Vite, Express, and Tailwind CSS.

## Project Structure

---

### Root Directory
- `server.ts`: The main Express.js backend entry point. It handles API requests, acts as a proxy, and serves the frontend in production modes.
- `package.json`: Manages project dependencies and defines CLI scripts (`dev`, `build`, `start`).
- `metadata.json`: Configuration file for application capabilities and permissions.
- `index.html`: The main entry point for the client-side SPA.
- `vite.config.ts`: Configuration for Vite, including Tailwind CSS integration.

### Frontend Source (`/src`)
- `App.tsx`: The core application container. Manages global state (tabs, configuration, users) and high-level routing.
- `types.ts`: Centralized TypeScript interfaces ensuring type consistency across the frontend and backend.
- `mockData.ts`: Holds initial mock data (e.g., AD tree nodes, job logs) used for development and demonstration.
- `index.css`: Global CSS entry point with Tailwind CSS directives and font imports.

### Frontend Components (`/src/components`)
- Shell Components:
  - `Sidebar.tsx`: Persistent navigation sidebar.
  - `TopBar.tsx`: Header component containing search and user profile actions.
- Tab Components (Features):
  - `ADExplorerTab.tsx`: Directory browser UI for Active Directory navigation.
    - `ADUCTree.tsx`: Helper for rendering hierarchical AD node structures.
  - `PDFProvisionTab.tsx`: The core multi-step workflow wizard for PDF-based automated user onboarding.
  - `JobQueueTab.tsx`: Monitor for background tasks and provisioning processes.
  - `DashboardTab.tsx`: Application overview.
  - `M365Tab.tsx`: Microsoft 365 licensing overview.
  - `SettingsTab.tsx`: App configuration and settings.
- UI Shared Components:
  - `Toast.tsx`: Notification system.

---

## Getting Started

### Development
1. Install dependencies: `npm install`
2. Run the development server: `npm run dev`

### Production
1. Build the application: `npm run build`
2. Start the production server: `npm start`
