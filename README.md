# NoteSpark AI 🚀

**Transform your world into intelligent, editable notes.* **Prerequisites**

* Node.js (v18 or newer)
* Yarn or npm
* React Native development environment set up for Android and iOS. See the [official guide](https://reactnative.dev/docs/environment-setup).
* An active Firebase project and a Google Gemini API key.teSpark AI is a production-ready, mobile-first application designed to capture, transform, and manage knowledge seamlessly. Using advanced AI and a powerful rich text editor, it turns physical documents, voice memos, and user ideas into fully formatted, auto-saving digital notes.

**Current Status:** ✅ **Production Ready** - Core application is stable and feature-complete.

---

## 📖 Table of Contents

1.  [**Key Features**](#-key-features)
2.  [**Technical Architecture**](#-technical-architecture)
3.  [**Getting Started**](#-getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
4.  [**Configuration**](#-configuration)
5.  [**Future Roadmap**](#-future-roadmap)

---

## ✨ Key Features

NoteSpark AI offers a complete, end-to-end workflow for modern note-taking and knowledge management.

### **1. Advanced Content Ingestion**
* **📄 Dual-Engine OCR Scanning**: Utilizes Google Cloud Vision (95%+ accuracy) as the primary OCR engine with a seamless fallback to the on-device ML Kit for offline capabilities.
* **✂️ Professional Image Cropping**: An integrated cropping tool allows users to select specific text areas from a captured image, increasing accuracy and reducing noise.
* **🎙️ Voice-to-Text Transcription**: A professional voice input system with real-time transcription, volume visualization, and a clear path to integrate advanced speech-to-text models.

### **2. Microsoft Word-Level Rich Text Editor**
* **✍️ Complete Formatting Suite**: A fully functional, two-row toolbar provides all essential editing tools, including bold, italic, underline, strikethrough, headers (H1-H3), text alignment, and blockquotes.
* **🎨 Advanced Styling**: Users can change font sizes, apply text and highlight colors from a palette, and create ordered or unordered lists.
* **📊 Rich Content**: Seamlessly insert tables with custom dimensions, add hyperlinks with URL validation, and use horizontal rules to structure notes.
* **🧠 Intelligent Auto-Save**: A smart, debounced auto-save system detects content changes and syncs them with Firebase in real-time, complete with live word count and save status indicators.

### **3. AI-Powered Note Transformation**
* **🤖 Smart Formatting**: Powered by Google Gemini 2.5 Flash, the app transforms raw OCR text into professionally structured notes with intelligent title generation.
* **🎭 Tone Selection**: Users can choose to format their notes in Professional, Casual, or Simplified tones to match their needs.

### **4. Robust Note Management & Export**
* **🗂️ Centralized Library**: All notes are stored and synced with Firebase Firestore, accessible through a clean, modern library screen with search and sort functionality.
* **📤 Modern Export System**: A native "Save As" dialog allows users to export notes as professionally formatted **PDF** or **RTF (Word-compatible)** documents.
* **🔗 Seamless Sharing**: Integrated with the native OS share sheet and a "copy to clipboard" function for easy content distribution.

### **5. Professional User Experience**
* **🔐 Secure Authentication**: Full integration with Firebase Authentication for email/password and social logins (Google & Apple).
* **🎨 Material Design 3**: A polished and intuitive user interface built with React Native Paper, featuring a dynamic dashboard, professional vector icons, and consistent theming.
* **🚀 Performance Optimized**: Built on a modern, "bleeding-edge" stack with React Native 0.80.2 and the New Architecture (Fabric) enabled for a smooth and responsive experience.

---

## 🛠️ Technical Architecture

### **Core Stack**
* **Framework**: React Native 0.80.2 (with New Architecture - Fabric)
* **Language**: TypeScript
* **UI Framework**: React Native Paper (Material Design 3)
* **Navigation**: React Navigation v7
* **State Management**: React Context & Hooks

### **Backend & Services**
* **Database & Auth**: Firebase (Firestore, Authentication, Storage)
* **Core AI Engine**: Google Gemini 2.5 Flash (for transformation and title generation)
* **Primary OCR**: Google Cloud Vision API
* **Fallback OCR**: ML Kit Text Recognition
* **Voice Recognition**: `@react-native-voice/voice`

---

## 🚀 Getting Started

Follow these instructions to get a local copy up and running for development and testing purposes.

### **Prerequisites**

* Node.js (v18 or newer)
* Yarn or npm
* React Native development environment set up for Android and iOS. See the [official guide](https://reactnative.dev/docs/environment-setup).
* An active Firebase project and an OpenAI API key.

### **Installation**

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/your-username/NoteSparkAI.git](https://github.com/your-username/NoteSparkAI.git)
    cd NoteSparkAI
    ```

2.  **Install NPM packages:**
    ```sh
    npm install
    ```

3.  **Install iOS Pods:**
    ```sh
    cd ios && pod install && cd ..
    ```

4.  **Set up environment variables:**
    * Create a `.env` file in the root of the project.
    * Add your Firebase configuration and Google Gemini API key:
        ```env
        GEMINI_API_KEY=your_gemini_api_key_here

        FIREBASE_API_KEY=your_firebase_api_key
        FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
        FIREBASE_PROJECT_ID=your_project_id
        FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
        FIREBASE_MESSAGING_SENDER_ID=your_sender_id
        FIREBASE_APP_ID=your_app_id
        ```

5.  **Run the application:**
    * **For Android:**
        ```sh
        npx react-native run-android
        ```
    * **For iOS:**
        ```sh
        npx react-native run-ios
        ```

---

## ⚙️ Configuration

* **Firebase:** Ensure your `google-services.json` (for Android) and `GoogleService-Info.plist` (for iOS) are placed in the correct directories (`android/app/` and `ios/NoteSparkAI/` respectively).
* **React Native Reanimated:** The Babel plugin is required. Ensure `'react-native-reanimated/plugin'` is the **last** item in the `plugins` array in `babel.config.js`.
* **Worklets:** `react-native-reanimated` v4+ requires `react-native-worklets`. Ensure it is installed and the Babel plugin is configured.

---

## 🔮 Future Roadmap

The next phase of development will focus on transforming NoteSpark AI into a market-leading intelligent learning suite, leveraging the power and cost-effectiveness of the **Google Gemini 2.5 Flash API**.

### **Phase 1: Advanced Content Ingestion**
* **Multi-Page Scanning:** Allow users to scan multiple pages in a single session.
* **Multi-Format Document Uploads:** Natively process `PDF`, `DOCX`, and `PPTX` files using Gemini 2.5 Flash's multi-modal capabilities.

### **Phase 2: Interactive Learning Suite (Pro Feature)**
* **AI-Powered Flashcards & Quizzes:** Automatically generate study aids from note content to enhance active recall and learning.

### **Phase 3: Dynamic Note Interaction (Pro Feature)**
* **Chat with Your Notes:** Implement a conversational AI (RAG model) that allows users to ask questions and get answers based *only* on the content of their notes.
