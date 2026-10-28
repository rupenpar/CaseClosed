# 🕵️ Case Closed: The AI Detective  

An interactive mystery game powered by the **Google Gemini API**.  
Chat with Detective Conan, analyze crime scenarios, and try to solve the case.  
When you type **`solve it`**, Conan reveals the truth.  

---

## 📷 Pages  

1. **Landing Page** – Start screen to begin the game  
   ![Landing Page](ReadmeAssets/ss1.png)  

2. **Loading Screen** – Fake suspenseful loading for game feel  
   ![Loading Screen](ReadmeAssets/ss2.png)  

3. **Chatbox** – Talk with Conan and solve mysteries  
   ![Chatbox](ReadmeAssets/ss3.png)  

---

## 🛠 Tech Stack  

- **Frontend**: React + TypeScript  
- **AI**: Google Gemini API  
- **Styling**: CSS / Tailwind

## Development

The Gemini API key is kept in the Node proxy and is never bundled into the frontend.

1. Copy `Backend/.env.example` to `Backend/.env` and add a new Gemini API key.
2. Start the proxy:

   ```bash
   cd Backend
   npm start
   ```

3. In a second terminal, start the frontend:

   ```bash
   cd Frontend
   npm run dev
   ```

The frontend sends requests to `/api/gemini`; Vite proxies them to the backend during development.