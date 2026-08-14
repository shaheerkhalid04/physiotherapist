/**
 * ============================================================================
 * DRAFT PROTOCOL TEMPLATES. NOT APPROVED FOR CLINICAL USE.
 * ============================================================================
 *
 * These are structured drafts of commonly described post-operative regimes,
 * written so the department has something concrete to correct rather than a
 * blank library. They are not a clinical recommendation and they have not been
 * reviewed by anyone.
 *
 * Every template seeds with reviewedById null and status DRAFT. An unreviewed
 * template cannot be assigned to a patient: PatientProtocol carries a NOT NULL
 * sourceTemplateReviewedById, so the database rejects the assignment.
 *
 * Before any patient sees any of this, a named surgeon or hand therapist must
 * work through each template in the admin interface, correct the phases,
 * timings, dosages and precautions to departmental practice, and sign it off.
 *
 * Dosages in particular are placeholders. Where a source describes a regime in
 * general terms, a plausible dosage has been written in so the data model is
 * exercised. Treat every number here as a question, not an answer.
 * ============================================================================
 */

export interface SeedExercise {
  name: string;
  instruction: string;
  sets: number;
  reps: number;
  holdSeconds: number;
  frequencyPerDay: number;
}

export interface SeedPhase {
  name: string;
  weekStart: number;
  weekEnd: number;
  goals: string;
  permittedMovements: string[];
  forbiddenMovements: string[];
  orthosis: string | null;
  orthosisSchedule: string | null;
  progressionCriteria: string;
  redFlags: string[];
  /** True while the repair is protected and orthosis non-compliance risks rupture. */
  protective: boolean;
  exercises: SeedExercise[];
}

export interface SeedProtocol {
  key: string;
  name: string;
  indication: string;
  source: string;
  phases: SeedPhase[];
}

const RUPTURE_FLAGS = [
  "Sudden loss of ability to bend the finger",
  "A snap or pop felt in the finger or hand",
  "Sudden increase in pain with loss of movement",
];

const WOUND_FLAGS = [
  "Fever",
  "Spreading redness around the wound",
  "Discharge or pus from the wound",
  "Pain that is increasing rather than settling",
];

const NEURO_FLAGS = [
  "New numbness in the fingers",
  "Fingers changing colour, going white, blue or very pale",
  "New coldness or cold intolerance in the hand",
];

export const PROTOCOL_TEMPLATES: SeedProtocol[] = [
  // 1 -----------------------------------------------------------------------
  {
    key: "zone-ii-flexor-early-active",
    name: "Zone II flexor tendon repair, early active motion",
    indication:
      "Primary repair of flexor digitorum profundus and superficialis in zone II with a repair strong enough for early active motion.",
    source: "Early active motion regimes, for departmental confirmation.",
    phases: [
      {
        name: "Protected early active motion",
        weekStart: 0,
        weekEnd: 4,
        goals: "Prevent adhesion while protecting the repair. Maintain passive glide.",
        permittedMovements: [
          "Place and hold composite fist within the orthosis",
          "Passive flexion of all finger joints",
          "Active extension to the orthosis limit",
        ],
        forbiddenMovements: [
          "Resisted gripping of any kind",
          "Lifting, carrying or pushing with the operated hand",
          "Passive extension of the fingers or wrist",
        ],
        orthosis: "Dorsal blocking orthosis, wrist neutral to slight flexion, MCP flexed, IP joints straight.",
        orthosisSchedule: "Worn at all times including sleep. Removed only for supervised exercise.",
        progressionCriteria:
          "Wound healed, no rupture signs, and passive flexion maintained. Clinician review required before progression.",
        redFlags: [...RUPTURE_FLAGS, ...WOUND_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Passive composite flexion",
            instruction:
              "With your other hand, gently bend the operated finger into your palm. Do not force it. Let it straighten back to the splint on its own.",
            sets: 1,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Place and hold fist",
            instruction:
              "Gently place the finger into a fist with your other hand, then hold it there very lightly using your own muscles. Do not squeeze.",
            sets: 1,
            reps: 10,
            holdSeconds: 5,
            frequencyPerDay: 4,
          },
          {
            name: "Active extension within the splint",
            instruction: "Straighten your fingers until they touch the roof of the splint. Do not push past it.",
            sets: 1,
            reps: 10,
            holdSeconds: 2,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Active flexion out of orthosis",
        weekStart: 5,
        weekEnd: 8,
        goals: "Restore active tendon glide and begin composite active fist.",
        permittedMovements: [
          "Active composite fist out of the orthosis",
          "Isolated FDS and FDP gliding",
          "Active wrist flexion and extension",
        ],
        forbiddenMovements: ["Resisted gripping", "Lifting more than a very light object"],
        orthosis: "Dorsal blocking orthosis retained for protection between sessions and at night.",
        orthosisSchedule: "Night wear and when out of the house. Removed for exercise and gentle light use.",
        progressionCriteria: "Active composite fist improving and no rupture signs. Clinician review required.",
        redFlags: [...RUPTURE_FLAGS, ...WOUND_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Active composite fist",
            instruction: "Slowly make a fist using your own muscles, then slowly straighten.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Hook fist",
            instruction: "Bend the middle and end joints of the finger while keeping the knuckles straight.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Straight fist",
            instruction: "Bend the knuckles and middle joints, keeping the end joint straight.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Strengthening",
        weekStart: 9,
        weekEnd: 12,
        goals: "Build grip strength and return to functional hand use.",
        permittedMovements: ["Graded resisted gripping", "Full functional use of the hand"],
        forbiddenMovements: ["Heavy manual work", "Contact sport"],
        orthosis: null,
        orthosisSchedule: null,
        progressionCriteria: "Grip strength improving toward the unaffected side. Clinician discharge decision.",
        redFlags: [...RUPTURE_FLAGS],
        protective: false,
        exercises: [
          {
            name: "Putty grip",
            instruction: "Squeeze the therapy putty into a full fist and release slowly.",
            sets: 3,
            reps: 15,
            holdSeconds: 3,
            frequencyPerDay: 2,
          },
          {
            name: "Tendon gliding series",
            instruction: "Move through straight hand, hook fist, straight fist and full fist positions.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 3,
          },
        ],
      },
    ],
  },

  // 2 -----------------------------------------------------------------------
  {
    key: "zone-ii-flexor-passive-kleinert-duran",
    name: "Zone II flexor tendon repair, Kleinert and modified Duran passive regime",
    indication:
      "Primary flexor tendon repair in zone II where repair strength or patient factors make early active motion unsuitable.",
    source: "Kleinert and modified Duran passive mobilisation, for departmental confirmation.",
    phases: [
      {
        name: "Passive mobilisation",
        weekStart: 0,
        weekEnd: 4,
        goals: "Maintain passive tendon glide with no active flexion whatsoever.",
        permittedMovements: [
          "Passive flexion by rubber band traction or by the other hand",
          "Active extension to the orthosis limit only",
        ],
        forbiddenMovements: [
          "Any active flexion of the operated finger",
          "Any gripping",
          "Passive extension of the fingers",
        ],
        orthosis:
          "Dorsal blocking orthosis with wrist and MCP flexed. Rubber band traction to the fingernail in the Kleinert variant.",
        orthosisSchedule: "Worn continuously, day and night, for the whole phase.",
        progressionCriteria: "Full passive flexion maintained and wound healed. Clinician review required.",
        redFlags: [...RUPTURE_FLAGS, ...WOUND_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Modified Duran passive PIP flexion",
            instruction:
              "Hold the knuckle still with your other hand and gently bend only the middle joint, then let it straighten.",
            sets: 1,
            reps: 10,
            holdSeconds: 5,
            frequencyPerDay: 6,
          },
          {
            name: "Modified Duran passive DIP flexion",
            instruction: "Hold the middle joint still and gently bend only the end joint of the finger.",
            sets: 1,
            reps: 10,
            holdSeconds: 5,
            frequencyPerDay: 6,
          },
          {
            name: "Active extension against traction",
            instruction: "Straighten the finger up to the roof of the splint, then relax and let the band bend it back.",
            sets: 1,
            reps: 10,
            holdSeconds: 2,
            frequencyPerDay: 6,
          },
        ],
      },
      {
        name: "Introduction of active flexion",
        weekStart: 5,
        weekEnd: 8,
        goals: "Begin gentle active flexion now the repair has gained tensile strength.",
        permittedMovements: ["Gentle active composite fist", "Differential tendon gliding"],
        forbiddenMovements: ["Resisted gripping", "Lifting"],
        orthosis: "Dorsal blocking orthosis retained at night and outdoors.",
        orthosisSchedule: "Night wear and when outside the home.",
        progressionCriteria: "Active flexion improving without extension lag increase. Clinician review required.",
        redFlags: [...RUPTURE_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Gentle active fist",
            instruction: "Slowly curl the fingers toward the palm using your own muscles, then straighten slowly.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Tendon gliding series",
            instruction: "Move through straight hand, hook fist, straight fist and full fist positions.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 3,
          },
        ],
      },
      {
        name: "Strengthening",
        weekStart: 9,
        weekEnd: 12,
        goals: "Restore grip strength and functional use.",
        permittedMovements: ["Graded resistance", "Normal light daily activity"],
        forbiddenMovements: ["Heavy lifting until cleared"],
        orthosis: null,
        orthosisSchedule: null,
        progressionCriteria: "Clinician discharge decision.",
        redFlags: [...RUPTURE_FLAGS],
        protective: false,
        exercises: [
          {
            name: "Putty grip",
            instruction: "Squeeze the putty into a full fist and release slowly.",
            sets: 3,
            reps: 15,
            holdSeconds: 3,
            frequencyPerDay: 2,
          },
        ],
      },
    ],
  },

  // 3 -----------------------------------------------------------------------
  {
    key: "extensor-zones-i-iv",
    name: "Extensor tendon repair, zones I to IV",
    indication:
      "Extensor tendon repair over the distal and middle phalanx and the PIP joint, including mallet and central slip injuries.",
    source: "Relative motion and short arc motion regimes, for departmental confirmation.",
    phases: [
      {
        name: "Immobilisation",
        weekStart: 0,
        weekEnd: 4,
        goals: "Protect the repair in extension and prevent extensor lag.",
        permittedMovements: ["Active movement of the uninvolved joints only"],
        forbiddenMovements: [
          "Any flexion of the repaired joint",
          "Removing the splint to wash the finger in a bent position",
        ],
        orthosis: "Static orthosis holding the repaired joint in full extension.",
        orthosisSchedule:
          "Worn continuously. The joint must not be allowed to drop into flexion at any point, including during washing.",
        progressionCriteria: "Wound healed and no extensor lag. Clinician review required.",
        redFlags: ["Finger dropping into a bent position and not straightening", ...WOUND_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Uninvolved joint motion",
            instruction: "Move the joints that are not in the splint through their full range.",
            sets: 2,
            reps: 10,
            holdSeconds: 2,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Short arc motion",
        weekStart: 5,
        weekEnd: 8,
        goals: "Begin controlled flexion through a limited arc while protecting extension.",
        permittedMovements: ["Short arc active flexion within the permitted range", "Active extension"],
        forbiddenMovements: ["Full composite fist", "Resisted extension"],
        orthosis: "Orthosis retained between exercise sessions and at night.",
        orthosisSchedule: "Removed for exercise only, otherwise worn.",
        progressionCriteria: "No extensor lag developing as flexion increases. Clinician review required.",
        redFlags: ["Increasing extensor lag", ...RUPTURE_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Short arc PIP flexion",
            instruction: "Bend the middle joint only as far as the therapist has marked, then straighten fully.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Active extension hold",
            instruction: "Straighten the finger fully and hold.",
            sets: 2,
            reps: 10,
            holdSeconds: 5,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Progressive motion and strengthening",
        weekStart: 9,
        weekEnd: 12,
        goals: "Regain composite flexion without losing extension.",
        permittedMovements: ["Full active flexion and extension", "Light resistance"],
        forbiddenMovements: ["Heavy resisted work until cleared"],
        orthosis: null,
        orthosisSchedule: null,
        progressionCriteria: "Clinician discharge decision.",
        redFlags: ["Extensor lag returning"],
        protective: false,
        exercises: [
          {
            name: "Composite fist",
            instruction: "Make a full fist and then fully straighten the fingers.",
            sets: 3,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 3,
          },
        ],
      },
    ],
  },

  // 4 -----------------------------------------------------------------------
  {
    key: "extensor-zones-v-viii",
    name: "Extensor tendon repair, zones V to VIII",
    indication:
      "Extensor tendon repair over the MCP joints, dorsum of the hand, wrist and distal forearm.",
    source: "Early controlled motion regimes for proximal extensor repairs, for departmental confirmation.",
    phases: [
      {
        name: "Protected early motion",
        weekStart: 0,
        weekEnd: 4,
        goals: "Protect the repair while preventing dorsal adhesion.",
        permittedMovements: ["Controlled active extension", "Limited active flexion within the orthosis"],
        forbiddenMovements: ["Composite fist", "Gripping", "Passive flexion stretch"],
        orthosis: "Volar orthosis with the wrist extended and MCP joints in slight flexion.",
        orthosisSchedule: "Worn continuously, removed only for prescribed exercise.",
        progressionCriteria: "Wound healed, no extensor lag. Clinician review required.",
        redFlags: ["Loss of ability to straighten the knuckles", ...WOUND_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Active MCP extension",
            instruction: "Straighten your knuckles against the splint and hold.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Limited MCP flexion",
            instruction: "Bend the knuckles only as far as the marked stop, then straighten.",
            sets: 2,
            reps: 10,
            holdSeconds: 2,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Progressive flexion",
        weekStart: 5,
        weekEnd: 8,
        goals: "Restore composite flexion while maintaining full extension.",
        permittedMovements: ["Progressive composite flexion", "Wrist motion in all planes"],
        forbiddenMovements: ["Resisted gripping"],
        orthosis: "Orthosis at night and for protection outdoors.",
        orthosisSchedule: "Night wear only, plus outdoors.",
        progressionCriteria: "Full active extension retained. Clinician review required.",
        redFlags: ["Extensor lag developing"],
        protective: false,
        exercises: [
          {
            name: "Composite flexion",
            instruction: "Make a fist gradually, going a little further each week as advised.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Wrist flexion and extension",
            instruction: "Bend the wrist forwards and backwards slowly.",
            sets: 2,
            reps: 10,
            holdSeconds: 2,
            frequencyPerDay: 3,
          },
        ],
      },
      {
        name: "Strengthening",
        weekStart: 9,
        weekEnd: 12,
        goals: "Restore grip and wrist strength.",
        permittedMovements: ["Graded resistance", "Return to normal activity"],
        forbiddenMovements: ["Heavy manual work until cleared"],
        orthosis: null,
        orthosisSchedule: null,
        progressionCriteria: "Clinician discharge decision.",
        redFlags: [],
        protective: false,
        exercises: [
          {
            name: "Putty grip and extension",
            instruction: "Squeeze the putty, then spread the fingers open against a rubber band.",
            sets: 3,
            reps: 15,
            holdSeconds: 3,
            frequencyPerDay: 2,
          },
        ],
      },
    ],
  },

  // 5 -----------------------------------------------------------------------
  {
    key: "distal-radius-volar-plate",
    name: "Distal radius fracture, volar plate fixation",
    indication: "Distal radius fracture treated with open reduction and volar locking plate fixation.",
    source: "Early motion after stable internal fixation, for departmental confirmation.",
    phases: [
      {
        name: "Early motion",
        weekStart: 0,
        weekEnd: 2,
        goals: "Control swelling, protect the wound, begin gentle wrist and finger motion.",
        permittedMovements: ["Active finger motion", "Gentle active wrist motion", "Elbow and shoulder motion"],
        forbiddenMovements: ["Weight bearing through the wrist", "Lifting", "Forced end range stretch"],
        orthosis: "Removable wrist orthosis for comfort and protection.",
        orthosisSchedule: "Worn between exercise sessions and in crowded places. Removed for exercises.",
        progressionCriteria: "Wound healed and swelling controlled. Clinician review required.",
        redFlags: [...WOUND_FLAGS, ...NEURO_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Finger tendon glides",
            instruction: "Move through straight hand, hook fist, straight fist and full fist.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Gentle wrist flexion and extension",
            instruction: "Bend the wrist forwards and backwards, only as far as is comfortable.",
            sets: 2,
            reps: 10,
            holdSeconds: 2,
            frequencyPerDay: 4,
          },
          {
            name: "Forearm rotation",
            instruction: "With the elbow tucked in, turn the palm up and then down.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Range of motion restoration",
        weekStart: 3,
        weekEnd: 6,
        goals: "Restore functional wrist and forearm range.",
        permittedMovements: ["Full active wrist and forearm motion", "Light functional use"],
        forbiddenMovements: ["Lifting more than a light household object", "Push ups or weight bearing"],
        orthosis: "Orthosis as needed for comfort only.",
        orthosisSchedule: "Discontinue during the day as comfort allows.",
        progressionCriteria: "Radiographic union confirmed by the surgeon before resistance begins.",
        redFlags: ["Sudden increase in wrist pain", ...NEURO_FLAGS],
        protective: false,
        exercises: [
          {
            name: "Wrist flexion and extension",
            instruction: "Move the wrist through its full comfortable range.",
            sets: 3,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 3,
          },
          {
            name: "Radial and ulnar deviation",
            instruction: "With the palm flat, move the hand side to side.",
            sets: 2,
            reps: 10,
            holdSeconds: 2,
            frequencyPerDay: 3,
          },
        ],
      },
      {
        name: "Strengthening",
        weekStart: 7,
        weekEnd: 12,
        goals: "Restore grip and forearm strength for daily and work tasks.",
        permittedMovements: ["Progressive resistance", "Return to work tasks as tolerated"],
        forbiddenMovements: ["Impact loading until cleared"],
        orthosis: null,
        orthosisSchedule: null,
        progressionCriteria: "Clinician discharge decision.",
        redFlags: [],
        protective: false,
        exercises: [
          {
            name: "Grip strengthening",
            instruction: "Squeeze the putty or ball and hold.",
            sets: 3,
            reps: 15,
            holdSeconds: 3,
            frequencyPerDay: 2,
          },
          {
            name: "Resisted forearm rotation",
            instruction: "Hold a light weight or hammer and turn the palm up and down slowly.",
            sets: 3,
            reps: 12,
            holdSeconds: 2,
            frequencyPerDay: 1,
          },
        ],
      },
    ],
  },

  // 6 -----------------------------------------------------------------------
  {
    key: "distal-radius-conservative",
    name: "Distal radius fracture, conservative management after cast removal",
    indication: "Distal radius fracture treated in a cast, beginning at cast removal.",
    source: "Post-cast mobilisation, for departmental confirmation.",
    phases: [
      {
        name: "Early mobilisation after cast removal",
        weekStart: 0,
        weekEnd: 3,
        goals: "Regain movement in a wrist that has been immobilised, and settle swelling and stiffness.",
        permittedMovements: ["Active wrist and forearm motion", "Full finger motion"],
        forbiddenMovements: ["Lifting", "Weight bearing through the hand", "Forced stretching"],
        orthosis: "Removable wrist orthosis for comfort in the first two weeks.",
        orthosisSchedule: "Worn outdoors and when the wrist feels vulnerable. Removed for exercise and at rest.",
        progressionCriteria: "Comfortable active range improving week on week. Clinician review required.",
        redFlags: ["Sudden severe pain", ...NEURO_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Wrist flexion and extension",
            instruction: "Rest the forearm on a table with the hand over the edge and move the wrist up and down.",
            sets: 3,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Forearm rotation",
            instruction: "Elbow tucked to your side, turn the palm up and then down.",
            sets: 3,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Finger tendon glides",
            instruction: "Move through the four fist positions.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 3,
          },
        ],
      },
      {
        name: "Strengthening and function",
        weekStart: 4,
        weekEnd: 10,
        goals: "Restore strength and return to daily activity.",
        permittedMovements: ["Progressive resistance", "Normal daily use"],
        forbiddenMovements: ["Heavy lifting until cleared"],
        orthosis: null,
        orthosisSchedule: null,
        progressionCriteria: "Clinician discharge decision.",
        redFlags: [],
        protective: false,
        exercises: [
          {
            name: "Grip strengthening",
            instruction: "Squeeze a soft ball or putty and hold.",
            sets: 3,
            reps: 15,
            holdSeconds: 3,
            frequencyPerDay: 2,
          },
        ],
      },
    ],
  },

  // 7 -----------------------------------------------------------------------
  {
    key: "carpal-tunnel-release",
    name: "Carpal tunnel release",
    indication: "Open or endoscopic decompression of the median nerve at the wrist.",
    source: "Post carpal tunnel release rehabilitation, for departmental confirmation.",
    phases: [
      {
        name: "Wound healing and early motion",
        weekStart: 0,
        weekEnd: 2,
        goals: "Protect the wound, prevent nerve and tendon adhesion, control scar.",
        permittedMovements: ["Full active finger motion", "Gentle wrist motion", "Light functional use"],
        forbiddenMovements: ["Heavy gripping", "Leaning on the heel of the hand"],
        orthosis: "None routinely.",
        orthosisSchedule: null,
        progressionCriteria: "Wound healed and sutures out. Clinician review required.",
        redFlags: [...WOUND_FLAGS, "Numbness that is worse than before surgery"],
        protective: false,
        exercises: [
          {
            name: "Tendon gliding series",
            instruction: "Move through straight hand, hook fist, straight fist and full fist.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
          {
            name: "Median nerve glide",
            instruction:
              "With the arm out to the side and palm up, gently straighten the elbow and ease the wrist back until you feel a light pull, then release. Never stretch into pins and needles.",
            sets: 1,
            reps: 8,
            holdSeconds: 2,
            frequencyPerDay: 3,
          },
        ],
      },
      {
        name: "Scar management and strengthening",
        weekStart: 3,
        weekEnd: 8,
        goals: "Desensitise the scar and restore grip strength, expecting pillar pain to settle slowly.",
        permittedMovements: ["Progressive gripping", "Return to most daily activity"],
        forbiddenMovements: ["Heavy manual work until pillar pain settles"],
        orthosis: null,
        orthosisSchedule: null,
        progressionCriteria: "Clinician discharge decision.",
        redFlags: ["Numbness returning after initial improvement"],
        protective: false,
        exercises: [
          {
            name: "Scar massage",
            instruction: "Massage the scar firmly in small circles with a plain moisturiser.",
            sets: 1,
            reps: 1,
            holdSeconds: 180,
            frequencyPerDay: 3,
          },
          {
            name: "Grip strengthening",
            instruction: "Squeeze the putty and hold.",
            sets: 3,
            reps: 12,
            holdSeconds: 3,
            frequencyPerDay: 2,
          },
        ],
      },
    ],
  },

  // 8 -----------------------------------------------------------------------
  {
    key: "dupuytren-fasciectomy",
    name: "Dupuytren fasciectomy",
    indication: "Surgical excision of Dupuytren cord with or without skin grafting.",
    source: "Post fasciectomy extension-focused rehabilitation, for departmental confirmation.",
    phases: [
      {
        name: "Extension protection and wound care",
        weekStart: 0,
        weekEnd: 4,
        goals: "Maintain the extension gained at surgery and heal the wound.",
        permittedMovements: ["Active flexion and extension of the fingers", "Full wrist motion"],
        forbiddenMovements: ["Heavy gripping", "Allowing the finger to rest in a flexed position"],
        orthosis: "Night extension orthosis holding the operated fingers straight.",
        orthosisSchedule:
          "Worn every night for the whole phase. Missing nights is the commonest reason extension is lost.",
        progressionCriteria: "Wound healed and extension maintained. Clinician review required.",
        redFlags: [...WOUND_FLAGS, "Finger becoming bent again", ...NEURO_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Active finger extension",
            instruction: "Place the hand flat on a table and straighten the fingers as far as they will go.",
            sets: 3,
            reps: 10,
            holdSeconds: 5,
            frequencyPerDay: 5,
          },
          {
            name: "Composite flexion",
            instruction: "Make a fist, then fully straighten.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Scar remodelling and strengthening",
        weekStart: 5,
        weekEnd: 12,
        goals: "Soften the scar, keep extension, restore grip.",
        permittedMovements: ["Progressive gripping", "Normal daily activity"],
        forbiddenMovements: [],
        orthosis: "Night extension orthosis continued.",
        orthosisSchedule: "Night wear continued for up to six months as advised.",
        progressionCriteria: "Clinician discharge decision.",
        redFlags: ["Recurrent contracture"],
        protective: false,
        exercises: [
          {
            name: "Scar massage",
            instruction: "Massage the scar firmly with moisturiser in small circles.",
            sets: 1,
            reps: 1,
            holdSeconds: 180,
            frequencyPerDay: 3,
          },
          {
            name: "Grip strengthening",
            instruction: "Squeeze the putty and hold.",
            sets: 3,
            reps: 12,
            holdSeconds: 3,
            frequencyPerDay: 2,
          },
        ],
      },
    ],
  },

  // 9 -----------------------------------------------------------------------
  {
    key: "digital-nerve-repair",
    name: "Digital nerve repair",
    indication: "Primary repair of a digital nerve, with or without associated flexor tendon injury.",
    source: "Post digital nerve repair protection and re-education, for departmental confirmation.",
    phases: [
      {
        name: "Protection",
        weekStart: 0,
        weekEnd: 3,
        goals: "Protect the repair from traction and protect an insensate finger from injury.",
        permittedMovements: ["Protected active motion within the orthosis"],
        forbiddenMovements: [
          "Full finger and wrist extension together, which puts the repair on stretch",
          "Handling hot objects with the numb finger",
        ],
        orthosis: "Dorsal orthosis limiting full extension to keep tension off the repair.",
        orthosisSchedule: "Worn continuously, removed for exercise only.",
        progressionCriteria: "Wound healed. Clinician review required before extension is increased.",
        redFlags: [...WOUND_FLAGS, "Burns or cuts on the numb finger"],
        protective: true,
        exercises: [
          {
            name: "Protected finger flexion",
            instruction: "Gently bend and straighten the finger within the limits of the splint.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Mobilisation and sensory re-education",
        weekStart: 4,
        weekEnd: 12,
        goals: "Restore full motion and begin sensory re-education as sensation returns.",
        permittedMovements: ["Full active motion", "Graded functional use"],
        forbiddenMovements: ["Heavy gripping until cleared"],
        orthosis: "Discontinued as advised.",
        orthosisSchedule: null,
        progressionCriteria: "Clinician discharge decision, with monofilament and two-point testing in clinic.",
        redFlags: ["No return of any sensation by the time advised"],
        protective: false,
        exercises: [
          {
            name: "Desensitisation",
            instruction: "Rub the fingertip with different textures such as cotton, cloth and a towel.",
            sets: 1,
            reps: 1,
            holdSeconds: 300,
            frequencyPerDay: 3,
          },
          {
            name: "Localisation practice",
            instruction:
              "With your eyes closed, have someone touch the finger and try to say exactly where. Then look and check.",
            sets: 1,
            reps: 10,
            holdSeconds: 0,
            frequencyPerDay: 2,
          },
        ],
      },
    ],
  },

  // 10 ----------------------------------------------------------------------
  {
    key: "peripheral-nerve-repair-upper-limb",
    name: "Peripheral nerve repair or nerve transfer, upper limb",
    indication: "Repair, grafting or transfer of a major upper limb peripheral nerve.",
    source: "Post nerve repair and transfer rehabilitation, for departmental confirmation.",
    phases: [
      {
        name: "Protection of the coaptation",
        weekStart: 0,
        weekEnd: 4,
        goals: "Protect the repair from tension and maintain passive joint range.",
        permittedMovements: ["Passive motion of joints within permitted limits", "Motion of unaffected joints"],
        forbiddenMovements: ["Positions that stretch the repaired nerve", "Resisted activity"],
        orthosis: "Positional orthosis keeping the limb in the tension-relieving position specified by the surgeon.",
        orthosisSchedule: "Worn continuously for the protection period.",
        progressionCriteria: "Surgeon confirms the protection period is complete.",
        redFlags: [...WOUND_FLAGS, "Sudden increase in pain radiating down the limb"],
        protective: true,
        exercises: [
          {
            name: "Passive range of motion",
            instruction: "Move each joint gently through range with your other hand, staying within the marked limits.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 3,
          },
        ],
      },
      {
        name: "Motor re-education",
        weekStart: 5,
        weekEnd: 24,
        goals: "Retrain the transferred or reinnervated muscle and prevent joint contracture while awaiting reinnervation.",
        permittedMovements: ["Active assisted and active motion", "Motor re-education drills"],
        forbiddenMovements: ["Heavy resistance until reinnervation is established"],
        orthosis: "Functional orthosis as prescribed.",
        orthosisSchedule: "As prescribed by the therapist.",
        progressionCriteria: "Evidence of reinnervation on clinical examination. Clinician review required.",
        redFlags: ["No sign of recovery within the expected window"],
        protective: false,
        exercises: [
          {
            name: "Motor re-education drill",
            instruction:
              "Perform the movement the donor nerve used to control, then try to link it to the new movement, as taught by your therapist.",
            sets: 3,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 3,
          },
          {
            name: "Contracture prevention range",
            instruction: "Move every joint of the limb through full range to keep them supple.",
            sets: 2,
            reps: 10,
            holdSeconds: 5,
            frequencyPerDay: 3,
          },
        ],
      },
    ],
  },

  // 11 ----------------------------------------------------------------------
  {
    key: "flexor-tendon-graft-two-stage",
    name: "Flexor tendon graft or two-stage reconstruction",
    indication: "Staged flexor tendon reconstruction with a silicone rod followed by tendon grafting.",
    source: "Two stage flexor reconstruction rehabilitation, for departmental confirmation.",
    phases: [
      {
        name: "Stage one, rod in place",
        weekStart: 0,
        weekEnd: 12,
        goals: "Maintain full passive range and form a smooth pseudosheath around the rod.",
        permittedMovements: ["Passive flexion and extension of the finger"],
        forbiddenMovements: ["Any active flexion attempt", "Gripping"],
        orthosis: "Dorsal blocking orthosis in the early weeks, then night extension orthosis.",
        orthosisSchedule: "As prescribed. Passive range is the priority throughout this stage.",
        progressionCriteria: "Full passive range achieved and maintained before the surgeon will graft.",
        redFlags: [...WOUND_FLAGS, "Rod becoming visible or palpable through the skin"],
        protective: true,
        exercises: [
          {
            name: "Passive composite flexion",
            instruction: "Gently bend the finger fully into the palm with your other hand, then let it straighten.",
            sets: 3,
            reps: 10,
            holdSeconds: 5,
            frequencyPerDay: 5,
          },
        ],
      },
      {
        name: "Stage two, after grafting",
        weekStart: 13,
        weekEnd: 24,
        goals: "Protect the graft as for a primary repair, then restore active glide.",
        permittedMovements: ["Protected passive and place and hold motion as prescribed"],
        forbiddenMovements: ["Resisted gripping", "Lifting"],
        orthosis: "Dorsal blocking orthosis as for a primary flexor repair.",
        orthosisSchedule: "Continuous in the early weeks after grafting.",
        progressionCriteria: "Clinician review at each stage. A graft is not stronger than a primary repair.",
        redFlags: [...RUPTURE_FLAGS],
        protective: true,
        exercises: [
          {
            name: "Place and hold",
            instruction: "Place the finger into a gentle fist with the other hand and hold lightly.",
            sets: 1,
            reps: 10,
            holdSeconds: 5,
            frequencyPerDay: 4,
          },
        ],
      },
    ],
  },

  // 12 ----------------------------------------------------------------------
  {
    key: "replantation-revascularisation",
    name: "Replantation and revascularisation",
    indication: "Replanted digit or hand, or revascularised limb segment.",
    source: "Post replantation protocol, for departmental confirmation.",
    phases: [
      {
        name: "Vascular monitoring",
        weekStart: 0,
        weekEnd: 3,
        goals: "Protect the anastomosis and monitor perfusion. Movement is secondary to circulation in this phase.",
        permittedMovements: ["Only the movement explicitly permitted by the surgeon"],
        forbiddenMovements: [
          "Smoking or exposure to smoke",
          "Cold exposure",
          "Caffeine if the surgeon has advised against it",
          "Any unsupervised exercise",
        ],
        orthosis: "Protective orthosis positioned by the surgical team.",
        orthosisSchedule: "Continuous. Not to be removed by the patient.",
        progressionCriteria: "Surgeon confirms the replant is perfused and stable.",
        redFlags: [
          "Finger turning white, blue or black",
          "Finger becoming cold compared with the others",
          ...WOUND_FLAGS,
        ],
        protective: true,
        exercises: [
          {
            name: "Perfusion check",
            instruction:
              "Photograph the finger in good light and record its colour and warmth. Contact the department immediately if it changes.",
            sets: 1,
            reps: 1,
            holdSeconds: 0,
            frequencyPerDay: 3,
          },
        ],
      },
      {
        name: "Protected mobilisation",
        weekStart: 4,
        weekEnd: 12,
        goals: "Begin motion of repaired structures within the limits set by the bone, tendon and nerve repairs.",
        permittedMovements: ["Protected active and passive motion as prescribed"],
        forbiddenMovements: ["Gripping", "Cold exposure"],
        orthosis: "As prescribed.",
        orthosisSchedule: "As prescribed.",
        progressionCriteria: "Bony union and surgeon approval.",
        redFlags: ["Colour change", "Sudden loss of movement"],
        protective: true,
        exercises: [
          {
            name: "Protected active motion",
            instruction: "Move the finger gently within the range your therapist has marked.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
        ],
      },
    ],
  },

  // 13 ----------------------------------------------------------------------
  {
    key: "rotator-cuff-repair",
    name: "Rotator cuff repair",
    indication: "Arthroscopic or open repair of a rotator cuff tear.",
    source: "Standard phased rotator cuff rehabilitation, for departmental confirmation.",
    phases: [
      {
        name: "Passive motion only",
        weekStart: 0,
        weekEnd: 6,
        goals: "Protect the repair completely while preventing shoulder stiffness.",
        permittedMovements: ["Passive elevation within limits", "Active elbow, wrist and hand motion", "Pendulum"],
        forbiddenMovements: [
          "Any active lifting of the arm",
          "Reaching behind the back",
          "Weight bearing through the arm",
        ],
        orthosis: "Sling or abduction pillow as prescribed.",
        orthosisSchedule: "Worn continuously including at night, removed only for prescribed exercise and washing.",
        progressionCriteria: "Surgeon confirms the protection period is complete.",
        redFlags: [...WOUND_FLAGS, "Sudden pop with loss of movement"],
        protective: true,
        exercises: [
          {
            name: "Pendulum",
            instruction: "Lean forward, let the arm hang, and let it swing gently in small circles. Do not use muscles to move it.",
            sets: 2,
            reps: 10,
            holdSeconds: 0,
            frequencyPerDay: 3,
          },
          {
            name: "Passive forward elevation",
            instruction: "Lying on your back, use the other arm to lift the operated arm up, then lower it slowly.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 3,
          },
          {
            name: "Elbow and hand motion",
            instruction: "Bend and straighten the elbow and make a fist to keep the rest of the arm moving.",
            sets: 2,
            reps: 15,
            holdSeconds: 2,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Active assisted to active motion",
        weekStart: 7,
        weekEnd: 12,
        goals: "Progress to active motion without resistance.",
        permittedMovements: ["Active assisted elevation", "Active motion in supported positions"],
        forbiddenMovements: ["Resisted strengthening", "Lifting"],
        orthosis: "Sling discontinued as advised.",
        orthosisSchedule: "Discontinue during the day.",
        progressionCriteria: "Comfortable active elevation without shrugging. Clinician review required.",
        redFlags: ["Sudden loss of active elevation"],
        protective: false,
        exercises: [
          {
            name: "Active assisted elevation with a stick",
            instruction: "Use a stick held in both hands to push the operated arm up overhead.",
            sets: 3,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 3,
          },
        ],
      },
      {
        name: "Strengthening",
        weekStart: 13,
        weekEnd: 24,
        goals: "Restore cuff and scapular strength and return to function.",
        permittedMovements: ["Progressive resisted strengthening", "Return to activity as cleared"],
        forbiddenMovements: ["Heavy overhead loading until cleared"],
        orthosis: null,
        orthosisSchedule: null,
        progressionCriteria: "Clinician discharge decision.",
        redFlags: [],
        protective: false,
        exercises: [
          {
            name: "Resisted external rotation",
            instruction: "With the elbow at your side and a band in your hand, rotate the forearm outwards slowly.",
            sets: 3,
            reps: 12,
            holdSeconds: 3,
            frequencyPerDay: 1,
          },
          {
            name: "Scapular retraction",
            instruction: "Squeeze the shoulder blades together and hold.",
            sets: 3,
            reps: 12,
            holdSeconds: 5,
            frequencyPerDay: 2,
          },
        ],
      },
    ],
  },

  // 14 ----------------------------------------------------------------------
  {
    key: "tendon-transfer-nerve-palsy",
    name: "Tendon transfer for radial, median or ulnar nerve palsy",
    indication: "Tendon transfer to restore function lost to radial, median or ulnar nerve palsy.",
    source: "Post tendon transfer re-education, for departmental confirmation.",
    phases: [
      {
        name: "Immobilisation",
        weekStart: 0,
        weekEnd: 4,
        goals: "Protect the transfer while the tendon juncture heals.",
        permittedMovements: ["Motion of joints not crossed by the transfer"],
        forbiddenMovements: ["Any active use of the transferred muscle", "Stretching the transfer"],
        orthosis: "Orthosis holding the limb in the position that keeps the transfer slack.",
        orthosisSchedule: "Continuous, removed only as instructed.",
        progressionCriteria: "Surgeon confirms healing is sufficient to begin re-education.",
        redFlags: [...WOUND_FLAGS, "Loss of the position the transfer produced"],
        protective: true,
        exercises: [
          {
            name: "Uninvolved joint motion",
            instruction: "Move the joints outside the splint through their full range.",
            sets: 2,
            reps: 10,
            holdSeconds: 2,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Motor re-education",
        weekStart: 5,
        weekEnd: 12,
        goals: "Teach the transferred muscle its new job.",
        permittedMovements: ["Active use of the transfer in the retraining position", "Graded functional practice"],
        forbiddenMovements: ["Resisted loading until cleared"],
        orthosis: "Orthosis retained between sessions and at night.",
        orthosisSchedule: "Night wear plus between practice sessions.",
        progressionCriteria: "Transfer firing reliably in the new direction. Clinician review required.",
        redFlags: ["Sudden loss of the new movement"],
        protective: false,
        exercises: [
          {
            name: "Transfer activation drill",
            instruction:
              "Perform the original action of the transferred muscle first, then try to produce the new movement, as taught by your therapist.",
            sets: 3,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Strengthening and function",
        weekStart: 13,
        weekEnd: 24,
        goals: "Strengthen the transfer and integrate it into daily tasks.",
        permittedMovements: ["Progressive resistance", "Functional task practice"],
        forbiddenMovements: ["Heavy manual work until cleared"],
        orthosis: null,
        orthosisSchedule: null,
        progressionCriteria: "Clinician discharge decision.",
        redFlags: [],
        protective: false,
        exercises: [
          {
            name: "Functional task practice",
            instruction: "Practise everyday tasks using the new movement, starting with light objects.",
            sets: 3,
            reps: 10,
            holdSeconds: 0,
            frequencyPerDay: 2,
          },
        ],
      },
    ],
  },

  // 15 ----------------------------------------------------------------------
  {
    key: "metacarpal-phalangeal-fracture-fixation",
    name: "Metacarpal and phalangeal fracture fixation",
    indication: "Metacarpal or phalangeal fracture treated with wires, screws or plate fixation.",
    source: "Post hand fracture fixation mobilisation, for departmental confirmation.",
    phases: [
      {
        name: "Protected early motion",
        weekStart: 0,
        weekEnd: 3,
        goals: "Control swelling and begin early motion to prevent stiffness, while protecting fixation.",
        permittedMovements: ["Active motion of the fingers within the orthosis", "Full motion of uninvolved digits"],
        forbiddenMovements: ["Gripping", "Lifting", "Twisting the hand"],
        orthosis: "Hand-based orthosis in the intrinsic plus position, MCP flexed and IP joints straight.",
        orthosisSchedule: "Worn continuously, removed for prescribed exercise.",
        progressionCriteria: "Wound healed, wires stable, radiographic progress. Clinician review required.",
        redFlags: [...WOUND_FLAGS, "Wire becoming loose or the skin around it becoming red and painful"],
        protective: true,
        exercises: [
          {
            name: "Active finger flexion",
            instruction: "Bend the fingers as far as the splint allows, then straighten.",
            sets: 2,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 5,
          },
          {
            name: "Uninvolved digit motion",
            instruction: "Move the fingers that are not injured through their full range.",
            sets: 2,
            reps: 10,
            holdSeconds: 2,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Full range restoration",
        weekStart: 4,
        weekEnd: 8,
        goals: "Regain composite fist and full extension after union.",
        permittedMovements: ["Full active motion", "Light functional use"],
        forbiddenMovements: ["Resisted gripping until union is confirmed"],
        orthosis: "Orthosis at night only.",
        orthosisSchedule: "Night wear.",
        progressionCriteria: "Radiographic union confirmed by the surgeon.",
        redFlags: ["Pain at the fracture site on movement"],
        protective: false,
        exercises: [
          {
            name: "Composite fist and full extension",
            instruction: "Make a full fist, then straighten the fingers completely.",
            sets: 3,
            reps: 10,
            holdSeconds: 3,
            frequencyPerDay: 4,
          },
        ],
      },
      {
        name: "Strengthening",
        weekStart: 9,
        weekEnd: 12,
        goals: "Restore grip strength and return to work.",
        permittedMovements: ["Progressive resistance", "Return to work as cleared"],
        forbiddenMovements: [],
        orthosis: null,
        orthosisSchedule: null,
        progressionCriteria: "Clinician discharge decision.",
        redFlags: [],
        protective: false,
        exercises: [
          {
            name: "Grip strengthening",
            instruction: "Squeeze the putty into a full fist and hold.",
            sets: 3,
            reps: 15,
            holdSeconds: 3,
            frequencyPerDay: 2,
          },
        ],
      },
    ],
  },
];
