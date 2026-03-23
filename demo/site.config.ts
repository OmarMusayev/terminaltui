import {
  defineSite,
  page,
  route,
  card,
  markdown,
  divider,
  link,
  list,
  ascii,
  spacer,
  form,
  textInput,
  button,
  createState,
  dynamic,
  request,
  navigate,
} from "../src/index.js";

// ─── OmarAI State & Logic ────────────────────────────────────────────────────

interface ChatMessage {
  role: string;
  content: string;
}

const chatState = createState<{
  messages: ChatMessage[];
  loading: boolean;
  error: string;
}>({
  messages: [],
  loading: false,
  error: "",
});

async function sendMessage(text: string) {
  if (!text.trim() || chatState.get("loading")) return;

  const userMsg: ChatMessage = { role: "user", content: text };
  chatState.update("messages", (prev) => [...prev, userMsg]);
  chatState.set("loading", true);
  chatState.set("error", "");

  try {
    const allMessages = chatState.get("messages");
    const res = await request.post("https://theomar.me/api/chat", {
      messages: allMessages,
    });

    if (res.ok && res.data?.message?.content) {
      const aiMsg: ChatMessage = {
        role: "assistant",
        content: res.data.message.content,
      };
      chatState.update("messages", (prev) => [...prev, aiMsg]);
    } else {
      chatState.update("messages", (prev) => [
        ...prev,
        { role: "assistant", content: "sorry, something went wrong. try again." },
      ]);
    }
  } catch {
    chatState.update("messages", (prev) => [
      ...prev,
      { role: "assistant", content: "couldn't connect. try again." },
    ]);
  } finally {
    chatState.set("loading", false);
  }
}

// ─── Helper: render chat messages ────────────────────────────────────────────

function renderChat() {
  const messages = chatState.get("messages");
  const loading = chatState.get("loading");
  const error = chatState.get("error");

  if (error) {
    return [markdown(`**Error:** ${error}`)];
  }

  if (messages.length === 0 && !loading) {
    return [
      markdown("**Ask me anything about Omar**\n\nI know about his experience, projects, education, and more."),
      spacer(),
      divider("Suggested Questions"),
      button({
        label: "What projects has Omar worked on?",
        style: "secondary",
        onPress: () => sendMessage("What projects has Omar worked on?"),
      }),
      button({
        label: "Tell me about Omar's education",
        style: "secondary",
        onPress: () => sendMessage("Tell me about Omar's education"),
      }),
      button({
        label: "What are Omar's AI skills?",
        style: "secondary",
        onPress: () => sendMessage("What are Omar's AI skills?"),
      }),
      button({
        label: "What is Omar's work experience?",
        style: "secondary",
        onPress: () => sendMessage("What is Omar's work experience?"),
      }),
    ];
  }

  const blocks = messages.map((msg) => {
    const sender = msg.role === "user" ? "You" : "OmarAi";
    return markdown(`**${sender}:** ${msg.content}`);
  });

  if (loading) {
    blocks.push(markdown("**OmarAi:** _thinking..._"));
  }

  return blocks;
}

// ─── Blog Post Content ───────────────────────────────────────────────────────

const blogPosts: Record<string, { title: string; date: string; content: string }> = {
  "1": {
    title: "OmarAi Dev Log 1",
    date: "September 8, 2024",
    content: `Hello Everybody,

Today I started working on a project that I have been meaning to do for a long time, creating an AI version of me. Well at least something similar, we all know that AI can't replace me but I need someone who I can rely on to answer questions about me to other people.

**Initial Plan:** My initial plan for this project is to fine-tune one of OpenAI's LLMs to get an idea of what the final product could look like. My idea was to download my message data from Instagram, which you can easily do through Instagram settings. However, the data that Instagram gives you needs to be heavily re-organized and scrubbed to be put into OpenAI's fine-tuning.

**The file structure it gives us is similar to this:**

messages/inbox/Xpersonsname/mychatlogswiththatperson

And inside, you'll find a file called \`message_1.json\` (sometimes more, depending on the length of the chat) and possibly folders for photos, videos, and other media shared in the chat.

The \`message_1.json\` files contain a series of messages exchanged between me and the other person, formatted as a JSON object.

There are a few ways I tried to organize this data into a way the fine-tuning can understand.

First, I tried to pair up every consecutive message that contained me at least once in the structure: Prompt : answer

But then I realized that when texting, I often double text, leading to the AI thinking I'm talking to myself.

I then fixed this problem and wrote a program to detect when I and another person send consecutive messages. I didn't realize it at the time, but this hadn't solved the problem either.

At the time, I was satisfied with the results and moved on to the fine-tuning. I tried fine-tuning 2 models:

- Babbage-002
- GPT-4o-mini-2024-07-18

However, they didn't give me the best of results. While GPT-4o-mini-2024-07-18 could give me actual responses, they were usually very short or just irrelevant. One thing it did pick up on was my vocabulary, and it would use words like "I mean", "Kinda", and "fr".

This is when I realized that the reason it was giving short outputs was because I was giving it short inputs in the training data. You see, my data only took 2 messages at a time, but we teenagers rarely fit our sentences into a single message. Instead, we send multiple messages that make up a complete sentence. So I decided on a new way to sort the data:

1. Merge all consecutive messages from the other person into one complete prompt.
2. Merge all consecutive responses from me into one complete reply.
3. Use this merged conversation to form a better prompt-response pair for training.

After doing this, I put my new data into the GPT-4o-2024-08-06 model fine-tuning, and as I am writing this, I am waiting for the model to train.

I will update you guys on the results in the next dev log.

See you guys later!!`,
  },
  "2": {
    title: "OmarAi Dev Log 2",
    date: "September 12, 2024",
    content: `Hello Everybody,

So, over the course of the past few days I have found some mistakes in my old codes for OmarAi and I have experimented with new things.

First thing first remember how I was waiting for my "GPT-4o-2024-08-06" model to fine tune? Well, that failed due to the huge number of data points I had which was around 20k+ message pairs. The model couldn't tokenize all this and train on it because I had set a limit on it to not use too many resources.

This was a good thing though because it prompted me to look over my data to see if there was anything I could cut out. This is when I realized that my data was heavily flawed. The algorithm I had used to convert my messages from just messages to conversation pairs looked at messages from the most recent to the oldest which caused a problem. The conversation pairs would take the last message sent as the first message sent and vice versa.

The fix for this was quite easy. I just had to reverse the order of messages before using the same algorithm to form conversation pairs.

Now, coming back to my original problem of having too many messages that took too many resources without contributing anything to the model, I first had to make sure that my conversations were in English. While looking at the data, I noticed that most of the conversations included Azerbaijani or even random languages that me and my friends had developed to talk to each other. This would negatively affect the future model as its language understanding would be confused so I had to find a way of cutting it.

The solution I came up with? Use AI!

I used the OpenAI gpt-3.5 API to go over each of my message pairs and convert them into data that was more useful to the model that I wanted to train. I made an algorithm to feed it 50 conversations at a time and for it to choose the best 4-5 each time which was in English.

This was a huge success and allowed me to downsize my dataset of 20 thousand conversations to around 2 thousand high quality conversations that could all contribute to fine tuning "OmarAI".

The next step was using an algorithm to comb over the new data and make sure all of it was in the format that was appropriate to fine-tune OpenAI models. The algorithm fixed all the inconsistencies gpt-3.5 had created in the syntax.

After the data was ready, I put it into gpt-4o API for fine tuning and went to sleep to see the results the next day.

I will keep you guys updated on how it turns out.`,
  },
  "3": {
    title: "OmarAi Dev Log 3",
    date: "September 14, 2024",
    content: `Hello Everybody,

Yesterday I was able to use the new model trained on the AI-picked data for the first time. It was a weird experience.

Since I hadn't made a UI for the model yet I just experimented around with it from a command prompt after writing a simple python code to communicate with my model.

The results were definitely interesting. It felt like the model had captured my conversation style and was able to sound similar to how I would text but it didn't have any memories. It would try to make up random information for the stuff it didn't know and this was a huge flaw as the REAL Omar would know about them all.

To fix this problem I explored a few things. First, I tried to turn my past conversations, resumes, essays, etc into text embeddings that I could use as a "memory" for the model. However this approach was too slow due to the large amount of information that the model had to go through each time. After that, I made a JSON file with all the information needed about me (including what I thought about my friends, family, etc) and tried to use OpenAI's new threads and multi agent systems to have one agent do a file search while the other would use the information from the file search in its responses. This approach also had its issues as having 2 agents instead of one used up lots of tokens as well as being extremely slow which made me finally opt in for simplicity.

Using the JSON file from the previous approach I was able to use OpenAI's system messages to give my model some context on the JSON so it can quickly search through it and pick the right data to answer questions. I also passed on a protocol into the model for it to not reveal any personal information.

This prompt seemed to work and for now training the model was finished. Up next is building a UI for the model.

See You guys later!`,
  },
  "4": {
    title: "OmarAi Dev Log 4",
    date: "September 18, 2024",
    content: `Creating the UI for OmarAI was definitely a journey and I am going to explain it here.

First I had to think about whether I wanted to build a separate website for Omar AI or if I wanted to use my current blog site for it. In the end I decided on using my own blog site as this website already has everything about me in one place so adding an actual Omar into the mix would be a pretty fun feature.

I first started looking for Next.js templates that could help me implement this and I came across a template that Subframe made for AI chat bots. However, when I tried to use it within my website, I ran into compatibility issues. There were multiple libraries and dependencies in the template that were a different version to the dependencies and libraries that I had used for my own website. This clash of dependencies caused the website to not function.

My thought process next was to create a chatbot frame on my own but there were problems with that too. Creating the front-end of the chatbot was quite easy but I couldn't get it to connect directly to the OpenAI API. I tried to do the back end within the Next.js app by using the API routes inside the project but I soon realized how much more difficult it was to code an API in JavaScript rather than Python which I am much more experienced in.

For this reason, I ended up opening a new backend project in Python where I put my AI model into and gave some instructions. After hosting that API on the cloud I made a call to it within the front end code of my website so that the frontend and back end were connected.

This way I had finally made a functional chatbot within my website.

Omar Musayev`,
  },
  "5": {
    title: "OmarAi Dev Log 5",
    date: "October 2, 2024",
    content: `Hello everyone!

I was finally able to launch my model to the public and was able to gather tons of feedback from my peers on how I should improve the model and make it more like me. This blog will explore the changes I've made on the program since the launch and my reasons for making these changes. Some changes were quite simple, like including some more information about me within the memory, but some were more complicated — such as tweaking the personality of the model through additional fine-tuning to allow it to give bigger and more comprehensive responses. Additionally, I have also tried to create new models based on other large language models like Llama, MPT, and Falcon.

One of the first things I noticed after launching OmarAI was that users enjoyed its conversational tone but wanted more depth. While my initial training data gave it a strong sense of my casual style — complete with slang and emojis — the AI often kept its answers too short or simplistic, especially when asked more elaborate questions. To fix this, I tweaked the fine-tuning to encourage lengthier, more detailed responses. I included examples of real conversations where I wrote lengthy paragraphs, or provided more involved stories and insights. This taught the AI to deliver fuller, richer answers rather than short, surface-level replies.

Another piece of feedback I consistently received was that the AI sometimes lacked continuity when referring to personal information. For example, it would occasionally mention random facts about me that I might have briefly referenced in older messages, but it wouldn't always remember important details I'd shared in the more recent data. To address this, I expanded the "memory" section of my system prompt. This memory now includes a curated list of facts about me — covering my interests, hobbies, close relationships, and notable personal anecdotes — so OmarAI has a more reliable context to draw upon. However, I also updated the protocols to ensure that truly sensitive or private information remains confidential. In other words, if someone asks for something personal that isn't meant to be shared, the AI knows to politely but firmly redirect the conversation without revealing anything I'd consider private.

Speaking of protocols, I made sure to refine them for both security and personality reasons. Originally, the model's system prompt included a friendly, casual directive, but some users tried to push boundaries by asking for deeply personal details. Now, OmarAI not only refuses to reveal such information, but it does so in a playful, lighthearted way — staying true to my personality while maintaining respect for personal boundaries. I also introduced a "playful fallback" mechanism, so when repeatedly pressed, OmarAI can politely deflect the conversation with a bit of humor, such as sharing a random fun fact or changing the subject in a friendly manner.

Finally, I experimented with building models based on Llama, MPT, and Falcon. While each has its strengths — like Llama's efficient performance or Falcon's open-source flexibility — I discovered that GPT-based models still deliver the best overall user experience in terms of coherence, creativity, and ease of deployment for my specific needs. In the future, I may consider a hybrid approach that leverages the benefits of multiple architectures, but for now, I'm happy with where OmarAI stands.

As I continue to refine and improve OmarAI, I'm grateful for everyone's feedback and support. Seeing people interact with an AI version of me has been both surreal and enlightening. There's still room to grow, but for now, I'm proud of the progress we've made and excited for what's next. Stay tuned for more updates, and feel free to keep sending feedback my way!`,
  },
};

// ─── Site Definition ─────────────────────────────────────────────────────────

export default defineSite({
  name: "Omar Musayev",
  handle: "@omarmusayev",
  tagline: "AI Engineer & Full Stack Developer",
  banner: ascii("OMAR", {
    font: "DOS Rebel",
    gradient: ["#ff8c00", "#ff6b35", "#fe8019"],
    shadow: true,
  }),
  theme: {
    accent: "#ff8c00",
    accentDim: "#cc7000",
    text: "#e0e0e0",
    muted: "#888888",
    subtle: "#333333",
    success: "#20C20E",
    warning: "#ffcc00",
    error: "#ff4444",
    border: "#ff8c00",
    bg: "#000000",
  },
  borders: "double",
  animations: {
    boot: true,
    transitions: "fade",
    exitMessage: "[ end of line ]",
    speed: "normal",
  },
  footer: "(c) 2026 Omar Musayev. All rights reserved.",
  pages: [

    // ═══════════════════════════════════════════════════════════════════════
    // HOME — About + Skills + Links
    // ═══════════════════════════════════════════════════════════════════════
    page("home", {
      title: "Home",
      icon: "◆",
      content: [
        markdown("I'm a double major in **Artificial Intelligence** and **Mathematics** at Purdue University with a **4.0 GPA**. Passionate about starting new projects, finishing what I can, and learning along the way. I love building things — especially with AI — and exploring how tech can solve real-world problems."),

        spacer(),
        divider("Skills"),
        list([
          "Multi-Agentic Systems",
          "LLM Fine-Tuning",
          "RAG Pipelines",
          "Prompt Engineering",
          "Computer Vision",
          "NLP",
          "TensorFlow",
          "PyTorch",
          "LangChain",
          "Neural Networks",
          "Reinforcement Learning",
          "Time Series Forecasting",
          "Python",
          "JavaScript",
          "React",
          "Next.js",
          "Node.js",
          "SQL",
          "Git",
          "Java",
          "C++",
        ], "check"),

        spacer(),
        divider("Connect"),
        link("Website: theomar.me", "https://theomar.me", { icon: ">" }),
        link("Email: omar.musayev.v.2@gmail.com", "mailto:omar.musayev.v.2@gmail.com", { icon: "~" }),
        link("LinkedIn", "https://www.linkedin.com/in/omar-musayev-267195286/", { icon: "#" }),
        link("Instagram", "https://www.instagram.com/omar.musayev/", { icon: "*" }),
        link("GitHub", "https://github.com/OmarMusayev", { icon: "+" }),
      ],
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // RESUME — Experience, Volunteering, Honors, Education
    // ═══════════════════════════════════════════════════════════════════════
    page("resume", {
      title: "Resume",
      icon: "▣",
      content: [

        // ── Experience ───────────────────────────────────────────────────
        divider("Experience"),
        card({
          title: "//Purdue LaunchPad",
          subtitle: "Website Chair & Organizer — 2025 – Present | West Lafayette, IN",
          body: "Website Chair and Organizer for Purdue's largest CS/DS mentorship community. LaunchPad is a one-on-one, semester-long mentorship program that pairs incoming students with upperclassmen, guiding them in building technical projects and fostering community through events and skill-building workshops.",
        }),
        card({
          title: "//COP-29 (UNFCCC)",
          subtitle: "ICT Technician — November 2024 | Baku, Azerbaijan",
          body: "Selected as one of 50 technicians from ~15,000 applicants for a 55,000-attendee conference. Tracked and maintained 1,000+ laptops, set up presentation equipment, assisted broadcasters/guests with technical issues, and coordinated daily patches and team memos.",
        }),
        card({
          title: "//Payriff",
          subtitle: "AI Intern — June 2024 – September 2024 | Baku, Azerbaijan",
          body: "Developed an AI-driven credit-scoring solution integrating data from banks and mobile providers. Built an AI chatbot to explain Payriff service APIs, streamlining developer onboarding.",
        }),
        card({
          title: "//Uşaqlarımıza Öyrədək",
          subtitle: "Lead Developer — January 2024 – Present | Baku, Azerbaijan",
          body: "Led development of a comprehensive website for a youth-led NGO supporting underprivileged children; published resources and promoted educational initiatives across Azerbaijan.",
        }),

        // ── Volunteering ─────────────────────────────────────────────────
        spacer(),
        divider("Volunteering"),
        card({
          title: "//F1 Baku City Circuit",
          subtitle: "Workforce Team Member — June 2022 | Baku, Azerbaijan",
          body: "Oversaw volunteer check-in/out and punctuality for ~1,500 volunteers; resolved operational issues throughout race weekend.",
        }),
        card({
          title: "//European Azerbaijan School",
          subtitle: "CAS Team Member — September 2024 – Ongoing | Baku, Azerbaijan",
          body: "Participated in environmental cleanup of beaches, mountains, and lakes in Azerbaijan.",
        }),

        // ── Honors & Awards ──────────────────────────────────────────────
        spacer(),
        divider("Honors & Awards"),
        card({
          title: "//Purdue Dean's List",
          subtitle: "2025 | West Lafayette, IN",
          body: "Named to the Purdue University Dean's List for academic excellence.",
        }),
        card({
          title: "//Purdue Semester Honors",
          subtitle: "2025 | West Lafayette, IN",
          body: "Awarded Semester Honors at Purdue University for outstanding academic performance.",
        }),
        card({
          title: "//Azerbaijan Olympiad in Informatics",
          subtitle: "Silver Medal — 2022 | Baku, Azerbaijan",
          body: "Recognized among top participants for outstanding performance in computer algorithms.",
        }),
        card({
          title: "//IELTS",
          subtitle: "Score: 8.5 — 2024 | Baku, Azerbaijan",
          body: "Achieved an 8.5 overall, with perfect scores in reading and listening.",
        }),
        card({
          title: "//SAT Superscore",
          subtitle: "Score: 1520 — 2024 | Baku, Azerbaijan",
          body: "Achieved a 1520 SAT superscore (780 Math, 740 Reading/Writing).",
        }),

        // ── Education ────────────────────────────────────────────────────
        spacer(),
        divider("Education"),
        card({
          title: "//B.S. in Artificial Intelligence & Mathematics",
          subtitle: "Purdue University — College of Science | August 2025 – Ongoing | West Lafayette, IN",
          body: "Double major in Artificial Intelligence and Mathematics. 4.0 GPA. Dean's List and Semester Honors recipient.",
        }),
        card({
          title: "//International Baccalaureate",
          subtitle: "European Azerbaijan School | 2022 – 2024 | Baku, Azerbaijan",
          body: "IBDP Subjects: Math AA HL, Business Management HL, Computer Science HL, English A SL, Physics SL, Spanish AB Initio. MYP: 7/7 from M23 Personal Project.",
        }),
        card({
          title: "//Pre-College: Introduction to Machine Learning for Astronomy",
          subtitle: "Harvard University | June – July 2024 | Boston, MA",
          body: "Applied machine learning algorithms to contemporary astronomical problems.",
        }),
        card({
          title: "//Pre-College: Data Science and Machine Learning 2",
          subtitle: "Columbia University | July – August 2024 | New York, NY",
          body: "Advanced course on data science and machine learning using Python and statistical methods.",
        }),
        card({
          title: "//Physics for Scientists and Engineers: Mechanics",
          subtitle: "University of California, Los Angeles (UCLA) | August – September 2024 | Online",
          body: "5-unit credit course covering fundamental mechanics for scientists and engineers.",
        }),
        card({
          title: "//Artificial Intelligence and Machine Learning",
          subtitle: "Stanford University | July – August 2023 | Palo Alto, CA",
          body: "NVIDIA DLI program using the Jetson Nano; hands-on AI/ML projects.",
        }),
        card({
          title: "//AI Scholars Program",
          subtitle: "Inspirit AI | August 2023 | Online",
          body: "Certificate program covering modern AI concepts and practical applications.",
        }),
      ],
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // PROJECTS
    // ═══════════════════════════════════════════════════════════════════════
    page("projects", {
      title: "Projects",
      icon: "◉",
      content: [
        card({
          title: "//Ushaqlarimiza Oyredek Website",
          subtitle: "Lead Developer — Web Development — 2024",
          body: "Served as the Lead Developer for a youth-led NGO focused on providing education to underprivileged children and fostering a passion for learning among youth.",
          tags: ["Web Development"],
          url: "https://ushaqlarimizaoyredek.com",
        }),
        card({
          title: "//World Temperature Forecasting",
          subtitle: "Researcher & Developer — AI Project — 2024",
          body: "Designed a time series model using LSTMs to predict global temperatures, aiding planning and combating climate change.",
          tags: ["AI", "LSTM", "Time Series"],
        }),
        card({
          title: "//AI Handwriting Generator",
          subtitle: "Developer — AI Project — May 2023",
          body: "A web application that generates realistic handwritten text using deep learning. Features two neural network approaches: a 3-layer LSTM with Gaussian attention for style transfer, and a 6-layer Transformer decoder that tokenizes strokes into polar coordinates. Users can draw on a canvas to capture their own handwriting style and generate personalized text. Built with PyTorch, FastAPI, and JavaScript.",
          tags: ["PyTorch", "FastAPI", "Deep Learning"],
          url: "https://hand-magic.com",
        }),
        link("  GitHub: ai-handwriting-generator", "https://github.com/OmarMusayev/ai-handwriting-generator", { icon: "+" }),
        spacer(),
        card({
          title: "//AI Jigsaw Puzzle Solver",
          subtitle: "Lead Developer — AI Project — Apr 2023",
          body: "Created an AI-driven jigsaw puzzle solver that automatically assembles pieces using computer vision techniques.",
          tags: ["Computer Vision", "AI"],
          url: "https://tinyurl.com/PuzzleSolvers",
        }),
      ],
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // BLOGS
    // ═══════════════════════════════════════════════════════════════════════
    page("blogs", {
      title: "Blogs",
      icon: "✦",
      content: [
        markdown("Development logs documenting the creation of **OmarAI** — an AI chatbot trained to talk like me."),
        spacer(),
        card({
          title: "//OmarAi Dev Log 1",
          subtitle: "September 8, 2024",
          body: "Starting on the journey to making an AI Large Language Model (LLM) that can replicate my speech.",
          tags: ["OmarAI", "LLM", "Fine-Tuning"],
          action: { navigate: "blog-post", params: { slug: "1" } },
        }),
        card({
          title: "//OmarAi Dev Log 2",
          subtitle: "September 12, 2024",
          body: "Tinkering around with Omar AI to get better results.",
          tags: ["OmarAI", "Data Quality"],
          action: { navigate: "blog-post", params: { slug: "2" } },
        }),
        card({
          title: "//OmarAi Dev Log 3",
          subtitle: "September 14, 2024",
          body: "Testing out the model.",
          tags: ["OmarAI", "Testing"],
          action: { navigate: "blog-post", params: { slug: "3" } },
        }),
        card({
          title: "//OmarAi Dev Log 4",
          subtitle: "September 18, 2024",
          body: "Creating the UI.",
          tags: ["OmarAI", "UI"],
          action: { navigate: "blog-post", params: { slug: "4" } },
        }),
        card({
          title: "//OmarAi Dev Log 5",
          subtitle: "October 2, 2024",
          body: "The Launch. Post-launch improvements, lengthier responses, expanded memory system, refined security protocols, and experimentation with Llama, MPT, and Falcon.",
          tags: ["OmarAI", "Launch", "Llama", "Falcon"],
          action: { navigate: "blog-post", params: { slug: "5" } },
        }),
      ],
    }),

    // ── Blog Post Routes ─────────────────────────────────────────────────
    route("blog-post", {
      title: (params) => blogPosts[params.slug]?.title ?? "Blog Post",
      icon: "✦",
      content: (params) => {
        const post = blogPosts[params.slug];
        if (!post) return [markdown("Post not found.")];
        return [
          markdown(`# ${post.title}`),
          markdown(`*${post.date}*`),
          divider(),
          markdown(post.content),
        ];
      },
    }),

    // ═══════════════════════════════════════════════════════════════════════
    // OMAR AI — Interactive Chat
    // ═══════════════════════════════════════════════════════════════════════
    page("omar-ai", {
      title: "//OmarAi",
      icon: "▸",
      content: [
        markdown("**//OmarAi** — Chat with an AI version of Omar. Ask about his experience, projects, education, skills, or anything else."),
        spacer(),
        dynamic(["messages", "loading", "error"], renderChat),
        divider(),
        form({
          id: "chat-form",
          onSubmit: async (data) => {
            const msg = data["chat-input"] as string;
            if (!msg?.trim()) return { error: "Type a message first." };
            await sendMessage(msg);
            return { success: "" };
          },
          fields: [
            textInput({
              id: "chat-input",
              label: "Chat with OmarAi",
              placeholder: "Ask me anything about Omar...",
            }),
            button({ label: "Send", style: "primary" }),
          ],
        }),
      ],
    }),
  ],
});
