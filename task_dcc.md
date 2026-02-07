# DCC-EX Train Control System - Full Application Description

## Overview
A simple full-stack train control application for managing DCC-EX (Digital Command Control) model railroad systems. 
The application provides a web-based interface to monitor and control multiple trains, configure train settings, and manage throttle controls and schedules management.

## Features
- train management
- throttle control
- schedules management
- settings management
- API-based communication with the backend and DCC-EX controller
- special end-point to proxy requests from the frontend to DCC-EX controller (sending DCC commands to the controller and receiving responses)

## Principles
- the simplest possible codebase and friendly UI/UX
- mobile-first
- responsive
- scalable
- testable
- documented (commented code)

## Appearance

main page:
  - top header with navigation to the other pages (trains, schedules, settings) or menu button if mobile
  - indicator of backend connection status (connected/disconnected)
  - indicator of DCC-EX controller connection status (connected/disconnected)
  - buttons: power on/off, emergency stop
  - A throttle control panel with tabs for each enabled train (only one train at a time)
    - train name and description
    - train address and control status (active/inactive)
    - a speed slider (0-126)
    - a direction toggle (forward/reverse)
    - a emergency stop button
    - group of three buttons for the three most used functions (Bell, Horn/Whistle, Lights)
    - two collapsible sections for the functions (Lights and Sounds)
      - each function has a button to toggle it on/off
      - each function has a button to toggle it on/off
    - show momentary functions as buttons, other functions as switches
    - show the function name and number
    - show the function icon if available
    - show/indicate the function state (on/off)
  - footer with copyright information

trains page:
  - A list of trains with their name, description, address, type, state, model, and functions
  - A button to add a new device (train or switch) (with a modal dialog)
    - name
    - description
    - address
    - type (train or switch)
    - state (active/inactive)
    - model
    - functions
  - A button to edit a device (with a modal dialog)
  - A button to delete a device (with confirmation)
  - A button to enable/disable a device (train or switch)

settings page:
    - indicator of backend connection status (connected/disconnected)
    - indicator of DCC-EX controller connection status (connected/disconnected)
    - a form to configure:
      - the backend connection (host, port, https) default origin of the frontend
      - the DCC-EX controller connection (host, port) default 192.168.4.1:2560
    - a button to save the settings
    - a button to reset the settings to default

schedules page:
    - a list of schedules with their name, description, notes, and schedule
    - a button to add a new schedule (with a modal dialog)
    - a button to edit a schedule (with a modal dialog)
    - a button to delete a schedule (with confirmation)

## Technology Stack

### Frontend
- **Framework**: Angular (latest version with standalone components, zoneless, reactive forms, signals, etc.)
- **Language**: TypeScript
- **Styling**: SCSS with Material Design principles
- **UI Components**: Angular Material and Google Material Icons
- **Architecture**: Component-based with services for state management and API communication
- **Mobile-first**: responsive design for mobile, tablet, and desktop, touch support

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **API Style**: RESTful
- **Architecture**: Route-based with modular structure
- **Data Model**: JSON files (no ORM, no database)

---

## Architecture

### Core Structure

Monorepo with shared types.

```
frontend/
├── src/
types/
backend/
├── src/
│   ├── routes/
│   │   └── trains.routes.ts
│   └── server.ts (implied)
```

### Data Model (`types.ts`) (example)
```typescript
interface device {
  uuid: string;
  name: string;                  
  description: string; // visible notes
  notes: string; // hidden notes
  address: number;               
  functions: DccFunction[];
  type: 'train' | 'switch';
  state: 'active' | 'inactive';
  model: string;
}

interface DccFunction {
  fn: number;
  name: string;
  label: string;
  group: 'lights' | 'sounds';
  icon?: string;
  momentary: boolean;
  enabled: boolean;
}

interface WeeklySchedule {
  id: string;
  name: string;
  description: string;
  notes: string;
  schedule: ScheduleItem[];
}

interface ScheduleItem {
  day: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  time: string; // "HH:MM"
  action: 'fn_on' | 'fn_off' | 'power_on' | 'power_off' | 'start' | 'stop' | 'set_speed';
  deviceUuid: string;
  fnNumber?: number;
  value?: number; // 0-126
  durationSec?: number; // in seconds
}
```
