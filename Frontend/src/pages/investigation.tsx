import React, { useState, useEffect, useRef } from "react";
import mainbg from "../assets/main-bg.jpg";
// import logo from "../assets/logo.png";
import conan2 from "../assets/conan-2.png";
import '../index.css'

interface Message {
  sender: "user" | "detective";
  text: string;
}
interface Suspect {
  name: string;
  age: number;
  motive: string;
  notes: string;
}
interface Evidence {
  name: string;
  description: string;
  likelihood: "High" | "Medium" | "Low";
}
interface CaseData {
  scenario: string;
  suspects: Suspect[];
  evidence: Evidence[];
  solution: string;
}

const Investigation: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [scenario, setScenario] = useState<string>("");
  const [suspects, setSuspects] = useState<Suspect[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [userInput, setUserInput] = useState<string>("");
  const [solution, setSolution] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState<boolean>(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      { sender: "detective", text: "Are you ready to solve the case, Detective?" },
    ]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoadingScreen(false);
    }, 4000); 
    return () => clearTimeout(timer); 
  }, []);

  const getLikelihoodColor = (likelihood?: string): string => {
    switch (likelihood?.toLowerCase()) {
      case "high":
        return "text-red-400";
      case "medium":
        return "text-yellow-400";
      case "low":
        return "text-green-400";
      default:
        return "text-gray-400";
    }
  };

  const callAPI = async (prompt: string, expectsJson = false): Promise<void> => {
    setIsLoading(true);
    
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.candidates || data.candidates.length === 0) {
          throw new Error("API returned no content.");
        }
        const rawText: string = data.candidates[0].content.parts[0].text;

        if (expectsJson) {
            const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "");
            const parsedResponse = JSON.parse(cleanedText) as CaseData;
            
            setScenario(parsedResponse.scenario);
            setSuspects(parsedResponse.suspects);
            setEvidence(parsedResponse.evidence);
            setSolution(parsedResponse.solution);
            setMessages(prev => [...prev, { sender: "detective", text: parsedResponse.scenario }]);
        } else {
            setMessages(prev => [...prev, { sender: "detective", text: rawText }]);
        }
    } catch (error) {
        console.error("Failed to fetch from Gemini API:", error);
        setMessages(prev => [...prev, { sender: "detective", text: "Sorry, I'm having trouble connecting with my sources. Please try again." }]);
    } finally {
        setIsLoading(false);
    }
  };

  // --- Send Logic ---
  const handleSend = (): void => {
    if (!userInput.trim() || isLoading) return;
    const newUserMessage: Message = { sender: "user", text: userInput };
    setMessages(prev => [...prev, newUserMessage]);
    const currentInput = userInput;
    setUserInput("");

    if (!gameStarted && currentInput.trim().toLowerCase().includes("yes")) {
      setGameStarted(true);
      const scenarioPrompt = `
       Generate a unique and compelling murder mystery case inspired by the style of "Detective Conan".
        Ensure the scenario, names, and motives are creative and not repetitive from one request to the next.
        - Location: Pick an interesting location like a film set, a remote inn, a tech company, or a theater.
        - Victim: Give the victim a clear profession and a reason why someone might want them dead.
        - Red Herring: Make one piece of evidence or a suspect's alibi a clever misdirection.
        - Names: Use a mix of common and unique Japanese names to avoid repetition.

        The response MUST be a single, valid JSON object with no markdown formatting.
        The JSON object must have three keys: "scenario", "suspects", and "evidence".
        - "scenario": A string (3-4 sentences) describing the intricate crime scene and victim.
        - "suspects": An array of 3 unique suspect objects. Each object needs "name", "age", "motive" (make it complex, not just 'money' or 'revenge'), and "notes" (a brief description of their alibi or behavior).
        - "evidence": An array of 3 evidence objects. Each object needs "name", "description", and "likelihood" ('High', 'Medium', or 'Low'). One of these should be the red herring.
        - "solution": A string (3-4 sentences) that clearly reveals the culprit's name, their motive, and how they executed the crime.
      `;
      callAPI(scenarioPrompt, true);
    } else if (gameStarted) {
     if (currentInput.trim().toLowerCase() === "solve the case") {
    if (solution) {
      setMessages(prev => [
        ...prev,
        { sender: "detective", text: solution }
      ]);
    } else {
      // Fallback message if the solution is not yet loaded or is missing
      setMessages(prev => [
        ...prev,
        { sender: "detective", text: "I'm still piecing together the final truth. Please be patient." }
      ]);
    }
  } else {
    // For all other inputs, continue the conversation with the AI
    const followUpPrompt = `
      You are the Great Detective. The current case is: "${scenario}".
      The suspects are: ${JSON.stringify(suspects.map(s => s.name))}.
      The evidence is: ${JSON.stringify(evidence.map(e => e.name))}.
      A junior detective asks you: "${currentInput}".
      For any other input, respond concisely, in character, based on the case details.
    `;
    callAPI(followUpPrompt, false);
  }
    } else {
      setMessages(prev => [
        ...prev,
        { sender: "detective", text: "Please type 'yes' to begin the investigation." },
      ]);
    }
  };
 if (showLoadingScreen) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <h1 className="font-specialelite text-white text-2xl md:text-4xl animate-pulse">
          There is only one truth...
        </h1>
      </div>
    );
  }

  // --- UI ---
  return (
    <>
      {/* Background */}
      <div>
        <img
          src={mainbg}
          className="fixed inset-0 h-full w-full object-cover z-[-10]"
        />
      </div>

      <div className="flex h-screen w-screen">
        {/* Left Space */}
        <div className="w-[13.5%]"></div>

        {/* Chatbox */}
        <div className="w-[80%] flex items-center justify-center relative h-screen overflow-hidden">
          <div className="bg-[black]/70 text-white p-5 w-[90%] h-[85%] overflow-y-auto rounded-lg">
            <div className="h-[85%] overflow-y-auto pr-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`m-2 flex ${
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`p-2 pl-3 pr-3 rounded ${
                      msg.sender === "user"
                        ? "bg-[#837f6c] text-black"
                        : "bg-[#8D5836] text-white"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && <div className=" m-2 text-gray-400">Typing...</div>}
              <div ref={chatEndRef} />
            </div>

            <div className="mt-2 flex">
              <input
                type="text"
                placeholder="Uncover the truth..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="flex-1 p-3 rounded-l bg-white text-black outline-none"
              />
              <button
                onClick={handleSend}
                className="px-4 bg-[#837f6c] text-black rounded-r"
              >
                Send
              </button>
            </div>
          </div>
        </div>

      <div className="w-[40%] flex flex-col gap-3 pt-12 h-full pr-8 overflow-hidden">
  {/* Suspects Section */}
  <div className="relative px-4 py-6 w-full flex-1 flex flex-col bg-black/50 rounded-xl mb-4 overflow-hidden">
    <h3 className="text-white text-2xl font-semibold text-center">Suspects</h3>
    <div className="w-30 h-[2px] bg-white mx-auto mb-4 rounded-full"></div>
    {/* Scroll only inside this */}
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
      {suspects.length > 0 ? (
        suspects.map((s, i) => (
          <div
            key={i}
            className="bg-black/30 border border-gray-800 hover:bg-gray-900/70 p-4 rounded-xl shadow-md transition-all duration-200 text-white w-full cursor-pointer group"
          >
            {/* Default (name only) */}
            <div className="group-hover:hidden">
              <h4 className="text-xl font-bold">🔎 {s.name}</h4>
            </div>
            {/* Hovered (details) */}
            <div className="hidden group-hover:block">
              <p><span className="font-bold">Age:</span> {s.age}</p>
              <p><span className="font-bold">Motive:</span> {s.motive}</p>
              <p><span className="font-bold">Notes:</span> {s.notes}</p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-gray-400 text-center">No suspects yet.</p>
      )}
    </div>
  </div>

  {/* Evidence Section */}
  <div className="relative px-4 py-6 w-full flex-1 flex flex-col bg-black/50 rounded-xl mb-4 overflow-hidden">
    <h3 className="text-white text-2xl font-semibold text-center">Evidence</h3>
    <div className="w-30 h-[2px] bg-white mx-auto mb-4 rounded-full"></div>
    {/* Scroll only inside this */}
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
      {evidence.length > 0 ? (
        evidence.map((e, i) => (
          <div
            key={i}
            className="bg-black/30 border border-gray-800 hover:bg-gray-900/70 p-4 rounded-xl shadow-md transition-all duration-200 text-white w-full cursor-pointer group"
          >
            {/* Default (name only) */}
            <div className="group-hover:hidden">
              <h4 className="text-xl font-bold">📄 {e.name}</h4>
            </div>
            {/* Hovered (details) */}
            <div className="hidden group-hover:block">
              <p className="italic">{e.description}</p>
              <p>
                <span className="font-bold">Likelihood: </span>
                <span className={getLikelihoodColor(e.likelihood)}>
                  {e.likelihood}
                </span>
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="text-gray-400 text-center">No evidence yet.</p>
      )}
    </div>
  </div>
</div>
</div>

      {/* Logo
      <div>
        <img
          src={logo}
          alt="logo"
          className="absolute top-4 left-4 w-20 sm:w-28 md:w-40 lg:w-64 h-auto z-50"
        />
      </div> */}

      {/* Conan PNG */}
      <div>
        <img
          src={conan2}
          alt="conan"
          className="absolute bottom-1 left-[-10px] w-20 sm:w-28 md:w-40 lg:w-64 h-auto z-50 scale-80"
        />
      </div>
    </>
  );
};

export default Investigation;
