export type QuizScale = readonly string[];

export type QuizQuestion = {
  id: string;
  prompt: string;
};

export type QuizSection = {
  key: string;
  title: string;
  subtitle?: string;
  intro?: string;
  scale: QuizScale;
  questions: QuizQuestion[];
};

const SCALE_FREQ = ["Never", "Infrequently", "Sometimes", "Most of the time", "Always"] as const;
const SCALE_FREQ_REVERSED = ["Always", "Most of the time", "Sometimes", "Infrequently", "Never"] as const;
const SCALE_AWARENESS = [
  "I'm not aware at all",
  "I'm a lit bit aware",
  "I am somewhat aware",
  "I am fairly aware",
  "I am really aware",
] as const;
const SCALE_YES_NO = ["No", "Yes"] as const;
const SCALE_UNLIKELY = [
  "None are unlikely",
  "1/5 are unlikely",
  "2/5 are unlikely",
  "3/5 are unlikely",
  "4/5 are unlikely",
  "5/5 are unlikely",
] as const;
const SCALE_RELATIONSHIPS = ["None", "0-5", "5-15", "15-35", "35-150"] as const;
const SCALE_OPENNESS = ["Not at all", "Very Rarely", "Sometimes", "Often", "Always"] as const;
const SCALE_LISTENING = [
  "None",
  "Less than 1 hour",
  "Less than 2 hours",
  "Less than 5 hours",
  "Less than 12 hours",
] as const;
const SCALE_PRESENCE = ["0-5 minutes", "5-60 minutes", "1-2 hours", "2-4 hours", "4+ hours"] as const;
const SCALE_SELF_KNOWLEDGE = ["Not at all", "A little bit", "Somewhat", "Pretty well", "Really well"] as const;

function section(
  key: string,
  title: string,
  scale: QuizScale,
  prompts: string[],
  extra?: { subtitle?: string; intro?: string },
): QuizSection {
  return {
    key,
    title,
    scale,
    subtitle: extra?.subtitle,
    intro: extra?.intro,
    questions: prompts.map((prompt, i) => ({ id: `${key}-${i}`, prompt })),
  };
}

export const QUIZ_SECTIONS: QuizSection[] = [
  section("imagination", "Imagination", SCALE_FREQ, [
    "Are you imaginatively hopeful?",
    "Do you feel energised by imagination?",
    "Does imagination make you feel safe to fail?",
    "Does imagination spark your curiosity?",
    "Do you accept imaginative chaos?",
    "Do you use an artist mindset to help you understand the world?",
    "Are you open to improvisation?",
    "Are you free to imagine what's possible?",
    "Do you go outside your comfort zone?",
    "Do you defy what already exists?",
    "Do you exercise your imagination?",
    "Are you okay with being happily misunderstood, knowing that not everything needs to be explained?",
    "Do you experience love when you're connected to the world of imagination?",
  ]),
  section("platypus", "A Note from a Platypus", SCALE_FREQ, [
    "Are you activating the intelligence of non-human, non-domesticated species?",
  ]),
  section("emergence", "Processes of Emergence", SCALE_FREQ, [
    "Are you open to emergent learning processes?",
  ]),
  section("invitation", "An Invitation", SCALE_FREQ, [
    "Do you invite people into dialogue, to share insights on what we value in our global economies?",
  ]),
  section("big-talk", "BIG Talk", SCALE_FREQ, [
    "What percentage of your time are you connecting with what you don't know and who you don't know?",
  ]),
  section("inheritance", "Inheritance", SCALE_FREQ, [
    "Do you have conversations about changing the systems we've inherited?",
  ]),
  section("potential", "Potential", SCALE_FREQ, [
    "Do you see potential for the networks that humans operate within to increase the health of the planet in the future?",
  ]),
  section(
    "relations-1",
    "See through a systemic lens - everything is in relation",
    SCALE_FREQ,
    ["Do you see the relations to everything everywhere all at once?"],
    { subtitle: "7 Elements of Relations" },
  ),
  section("relations-2", "Activate imagination", SCALE_FREQ, [
    "Do you activate imagination when building and nurturing relationships?",
  ], { subtitle: "7 Elements of Relations" }),
  section("relations-3", "Emergence as impact tool and area of investment", SCALE_FREQ, [
    "Do you try and control the outcomes of life?",
  ], { subtitle: "7 Elements of Relations" }),
  section("relations-4", "Centring knowledge and expertise openly shared in network design", SCALE_FREQ, [
    "Do you seek out experts and knowledge holders?",
  ], { subtitle: "7 Elements of Relations" }),
  section("relations-5", "Centring nature and designing with from and in relation to it", SCALE_FREQ, [
    "Are you thinking about how your knowledge and resources should ultimately return to nature?",
  ], { subtitle: "7 Elements of Relations" }),
  section("relations-6", "Networking with unlikely connections (UNCx5)", SCALE_UNLIKELY, [
    "Are the core 5 relations in your life likely or unlikely?",
  ], { subtitle: "7 Elements of Relations" }),
  section(
    "relations-7",
    "Give, give, receive, receive - time knowledge and opportunities",
    SCALE_FREQ,
    ["Do you give your knowledge openly and freely?", "Do you accept offers of help?"],
    { subtitle: "7 Elements of Relations" },
  ),
  section("imagi-nation", "Imagi-NATION", SCALE_YES_NO, ["Could you create a new nation?"]),
  section("death", "Death", SCALE_FREQ, [
    "How often are you engaging in discussions around the topic of intentional death in the context of individuals, organisations, systems?",
  ]),
  section("mentors-not-saviours", "Mentors Not Saviours", SCALE_FREQ, [
    "Should mentoring relationships have an end point?",
  ]),
  section("hope", "Hope", SCALE_FREQ, ["Do you pass on hopeful knowledge?"]),
  section("change", "Change", SCALE_RELATIONSHIPS, [
    "How many relationships have you been engaged in with other human beings that positively affected and changed the outcome of the other human being's life and your own?",
  ]),
  section("freedom", "Freedom", SCALE_OPENNESS, ["How open are you to being wrong?"]),
  section("rebellious", "Rebellious", SCALE_FREQ, ["Do you make new rules?"]),
  section("listening", "Listening", SCALE_LISTENING, [
    "How much time do you spend each day listening?",
  ]),
  section("empathy", "Empathy", SCALE_FREQ, [
    "How often do other peoples' stories change the way you live your life?",
  ]),
  section("brave-goals", "Brave Goals", SCALE_FREQ, [
    "Have you ever set big, risky, audacious, visionary, endless goals?",
  ]),
  section("no-shame", "No Shame", SCALE_FREQ_REVERSED, [
    "How often are you ashamed when trying something new in front of people?",
  ]),
  section("initiative", "Initiative", SCALE_FREQ, ["Do you wait to be told what to do?"]),
  section("yes-and", "Yes And", SCALE_FREQ, [
    "When someone shares an idea, how often do you say \"yes\" as the first response?",
  ]),
  section("forgiveness", "Forgiveness", SCALE_FREQ, ["Do you forgive others and yourself?"]),
  section("kindness", "Kindness", SCALE_FREQ, ["How often do you engage in acts of kindness?"]),
  section("gift-of-time", "Gift of Time", SCALE_PRESENCE, [
    "How many minutes a day are you deeply present in that place and space you are in?",
  ]),
  section("failure", "Failure", SCALE_FREQ, ["Are you afraid of failure?"]),
  section("asking-questions", "Asking Questions", SCALE_FREQ, [
    "When you don't know something, do you ask a question?",
  ]),
  section("effort", "Effort", SCALE_FREQ, ["Do you give everything you can?"]),
  section("know-yourself", "Know Yourself", SCALE_SELF_KNOWLEDGE, [
    "How well do you know yourself?",
  ]),
  section(
    "logic",
    "Logic",
    SCALE_AWARENESS,
    [
      "Ad antiquitatem - An idea that is claimed to be right because it is the way it was often done in the past. e.g. Just because it's traditional, doesn't mean it's good for this time and place",
      "Ad naturam - tactic in which it is proposed that \"a thing is good because it is 'natural', or bad because it is unnatural.\" e.g. Just because it's natural in one time and place, doesn't mean it's true in all contexts.",
      "Cum hoc ergo propter hoc - informal fallacy that states: \"Since event Y followed event X, event Y must have been caused by event X.\" e.g. I can not assume that because I farted after I ate the beans that the beans caused the fart",
      "Dicto simpliciter - Occurs when the arguer fails to recognise the difference between rules of thumb and categorical propositions, rules that hold true universally. e.g. I cannot kill the exception to the rule - every time and place relation sits in a unique context and is never universal.",
      "Ab anecdote - Where anecdotal evidence is presented as an argument; without any other contributory evidence or reasoning. e.g. personal stories are not proof, and can metastasise across an information landscape and tear it up like a multitude of feral pigs.",
      "Tu quoque - is a discussion technique that intends to discredit the opponent's argument by attacking the opponent's own personal behaviour and actions as being inconsistent with their argument, therefore accusing hypocrisy. e.g. I am not a bully in the playground so \"I know you are but what am I?\" is not a valid argument.",
      "Ad temperantiam - considering two statements about the colour of the sky on Earth during the day - one claiming, correctly, that the sky is blue, and another claiming that it is yellow - and incorrectly concluding that the sky is the intermediate colour, green. e.g. I can not assume that being on the fence between two enemies is the right place to be",
      "Ad fastidium (or \"appeal to disgust\" or \"argument from disgust\" or \"wisdom of repugnance\" or \"yuck factor\") is a logical fallacy that occurs when it is argued that something is morally wrong because it is gross (or conversely, it is good because it is beautiful). e.g. I must not hijack peoples feelings by making them feel disgust just to win an argument",
      "Onus probandi is the obligation to provide sufficient supporting evidence for claims that you make. For example, if someone claims that ghosts exist, then the burden of proof means that they need to provide evidence that supports this. e.g. I cannot push forward false claims by demanding that others prove that they are right or wrong",
      "Ad ignorantiam also known as appeal to ignorance (in which ignorance represents \"a lack of contrary evidence\"), is a fallacy in informal logic. It asserts that a proposition is true because it has not yet been proven false or a proposition is false because it has not yet been proven true. e.g. I cannot claim that something is true just because it has not been proven false",
    ],
    { intro: "How aware are you of these logic fallacies and the consequences they can have in your relationships?" },
  ),
  section("systems-theory", "Theoretical Engagement with Indigenous Systems Design", SCALE_FREQ, [
    "How often do you engage theoretically with Indigenous systems design?",
  ]),
  section("systems-application", "Application of Indigenous Systems Design", SCALE_FREQ, [
    "How often do you apply Indigenous systems processes to how you design?",
  ]),
  section("systems-knowledge", "Indigenous Knowledge in Systemic Design", SCALE_FREQ, [
    "How often do you encounter instances where marginalised knowledge systems are integrated into systemic design to address social or environmental challenges?",
  ]),
  section("relational-map", "Relational Map", SCALE_AWARENESS, [
    "How aware are you of your relational map?",
  ]),
];

export const DEFAULT_QUIZ_ANSWERS: Record<string, number> = QUIZ_SECTIONS.reduce(
  (acc, s) => {
    const mid = Math.floor((s.scale.length - 1) / 2);
    for (const q of s.questions) acc[q.id] = mid;
    return acc;
  },
  {} as Record<string, number>,
);
