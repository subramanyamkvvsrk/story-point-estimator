# Story Point Estimator

A simple, intuitive web-based tool for agile teams to estimate user stories using the Fibonacci sequence. Built with React and TailwindCSS for a modern, responsive experience.

## Features

- ✅ **Add/Edit/Remove Stories** - Manage your backlog items easily
- ✅ **Fibonacci Point System** - Use standard agile estimation values (0, 1, 2, 3, 5, 8, 13, 21, 34, 55)
- ✅ **Real-time Summary** - See total points, estimated stories count, and overall progress
- ✅ **Local Storage** - Your estimations are automatically saved in browser
- ✅ **Responsive Design** - Works great on desktop and mobile devices
- ✅ **Clean UI** - Modern, intuitive interface with Lucide icons

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn package manager

### Installation

1. **Navigate to the project directory:**
   ```bash
   cd story-point-estimator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

4. **Open your browser and visit:**
   ```
   http://localhost:3000
   ```

### Building for Production

To create a production build:

```bash
npm run build
```

The build files will be generated in the `build/` directory.

## How to Use

1. **Add a New Story**: Enter a story title in the input field and click "Add Story"
2. **Estimate Points**: Click on any Fibonacci number to assign story points
3. **Edit Stories**: Click the edit icon next to any story title to modify it
4. **Remove Stories**: Click the trash icon to delete stories you no longer need
5. **Track Progress**: View your summary cards showing total points and progress

## Technology Stack

- **React 18** - Frontend framework
- **TailwindCSS** - Utility-first CSS framework
- **Lucide React** - Beautiful, customizable icons
- **Local Storage** - Client-side data persistence

## Project Structure

```
story-point-estimator/
├── public/
│   └── index.html
├── src/
│   ├── App.js          # Main application component
│   ├── index.js        # React app entry point
│   └── index.css       # Global styles with Tailwind imports
├── package.json        # Dependencies and scripts
├── tailwind.config.js  # Tailwind configuration
└── postcss.config.js   # PostCSS configuration
```

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm run eject` - Ejects from Create React App (one-way operation)

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the MIT License.
