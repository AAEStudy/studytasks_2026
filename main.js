// main.js (ES module)
// Orchestrates interleaving MRT and Meta-Emotion calibration while producing ONE file per task.
//
// Data saving (OSF pipe + Qualtrics redirect) is included but commented where you will enable it.

import { initMetaEmotion, buildMetaEmotionPractice, buildMetaEmotionCalibrationChunk, buildMetaEmotionReview, buildMetaEmotionMetaJ, exportMetaEmotion } from "./metaemotion.js";

// Helper: URL param
function getParam(name){ return new URLSearchParams(window.location.search).get(name); }

// Qualtrics-provided participant ID (edit key if needed)
const subjectID = getParam("id") || getParam("PROLIFIC_PID") || "NA";

// Qualtrics return link (edit key if needed)
// const qualtricsReturn = getParam("return") || null;

// Prepare audio for MRT (uses same filenames as your MRT task; adjust if your repo differs)
const metronomeAudio = new Audio("sounds/metronomeMono.mp3");

// Transition screen helper (SPACE to continue)
function transitionScreen(html, dataExtra={}){
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="center" style="font-size:22px; line-height:1.35; max-width:900px; margin:0 auto;">${html}</div>`,
    choices: [" "],
    data: {task:"system", event:"transition", ...dataExtra}
  };
}

// Unlock audio on user gesture (required by browsers)
function audioUnlockTrial(){
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="center" style="font-size:22px; line-height:1.35;">
      <p><b>Metronome Task</b></p>
      <p>Press <b>SPACE</b> to continue (this enables audio).</p>
    </div>`,
    choices: [" "],
    on_finish: async () => {
      try {
        metronomeAudio.currentTime = 0;
        await metronomeAudio.play();
        metronomeAudio.pause();
        metronomeAudio.currentTime = 0;
      } catch(e) {}
      try {
        bellAudio.currentTime = 0;
        await bellAudio.play();
        bellAudio.pause();
        bellAudio.currentTime = 0;
      } catch(e) {}
    },
    data: {task:"system", event:"audio_unlock"}
  };
}


// Global shared state for interleaving
const sharedState = { mrtCursor: 0 };

const jsPsych = initJsPsych({
  on_finish: async () => {
    // ---- Create MRT TSV from your existing MRT customData ----
    // This assumes buildMRTChunk returns {customData, convertToCSV}.
    // We stash it on window after first build.
    const mrtApi = window.__mrtApi;
    const mrtTsv = mrtApi ? mrtApi.convertToCSV(mrtApi.customData) : "";

    // ---- Create Meta-Emotion Matlab-style CSVs ----
    const metaOut = exportMetaEmotion(window.__metaState, jsPsych);

    // ---- Save to OSF with pipe.js (COMMENTED) ----
    /*
    const saveMRT = {
      type: jsPsychPipe,
      action: "save",
      experiment_id: "YOUR_OSF_ID",
      filename: `MRT_${subjectID}.tsv`,
      data_string: () => mrtTsv
    };
    const saveCali = {
      type: jsPsychPipe,
      action: "save",
      experiment_id: "YOUR_OSF_ID",
      filename: `Meta_emotion_cali_${subjectID}_${metaOut.stamp}.csv`,
      data_string: () => metaOut.caliCsvText
    };
    const saveMetaJ = {
      type: jsPsychPipe,
      action: "save",
      experiment_id: "YOUR_OSF_ID",
      filename: `Meta_emotion_metaJ_${subjectID}_${metaOut.stamp}.csv`,
      data_string: () => metaOut.metaJCsvText
    };
    await jsPsych.run([saveMRT, saveCali, saveMetaJ]);
    */

    // ---- Redirect back to Qualtrics (COMMENTED) ----
    /*
    if (qualtricsReturn) window.location.href = qualtricsReturn;
    */
  }
});

jsPsych.data.addProperties({ subject: subjectID });

// Make jsPsych available for MRT builder (it expects params.jsPsych)
window.__jsPsychInstance = jsPsych;

async function start(){
  // Init Meta-Emotion lists
  const metaState = await initMetaEmotion({ subject: subjectID });
  window.__metaState = metaState;

  // Build MRT chunk API (from your retained task)
  // NOTE: buildMRTChunk is defined in mrt.js (loaded before main.js)
  const mrtApi = buildMRTChunk({
    jsPsych,
    subjectID,
    metronomeAudio,
    _state: sharedState,
    // numBlocks: 35,      // keep original, adjust if needed
    // includeMidBreak: true
    blocksToTake: 0       // build internal structures but take none yet
  });
  // buildMRTChunk returns an API with timeline/customData/convertToCSV
  window.__mrtApi = mrtApi;

  const timeline = [];

  // ---- Preload Meta-Emotion images to prevent uneven display / blank frames ----
  const metaPreload = [];
  // practice images
  for (const t of metaState.practicePairs){ metaPreload.push("stimuli/practice/" + t.p1); metaPreload.push("stimuli/practice/" + t.p2); }
  // calibration images (pairs)
  for (const t of metaState.calibrationPairs){ metaPreload.push("stimuli/formal/" + t.p1); metaPreload.push("stimuli/formal/" + t.p2); }
  // review + meta lists
  for (const fn of metaState.reviewList){ metaPreload.push("stimuli/formal/" + fn); }
  for (const fn of metaState.metaList){ metaPreload.push("stimuli/formal/" + fn); }
  // instruction images
  metaPreload.push("assets/instruction.jpg","assets/endx_prac.jpg","assets/restx.jpg","assets/instruction2.jpg");

  timeline.push({
    type: jsPsychPreload,
    images: [...new Set(metaPreload)],
    show_progress_bar: true
  });


  // Start screen
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="center" style="font-size:24px; line-height:1.35;">
      <p><b>Session</b></p>
      <p>Press <b>SPACE</b> to begin.</p>
    </div>`,
    choices: [" "],
    data: {task:"system", event:"start"}
  });

  // Optional: Meta-Emotion practice
  timeline.push(...buildMetaEmotionPractice(metaState));

  // -------- Interleaving plan --------
  const CALI_CHUNK = 10;     // adjust
  const MRT_BLOCKS_PER_CHUNK = 2; // adjust (number of MRT blocks to run before switching)

  // Cali chunk 1
  timeline.push(...buildMetaEmotionCalibrationChunk(metaState, CALI_CHUNK, 1));

  // MRT chunk 1 (take N blocks)
    timeline.push(audioUnlockTrial());
  timeline.push(...buildMRTChunk({ jsPsych, subjectID, metronomeAudio, _state: sharedState, includeMidBreak: false, blocksToTake: MRT_BLOCKS_PER_CHUNK }).timeline);

  timeline.push(transitionScreen("<p><b>Meta-Emotion Calibration</b></p><p>Press <b>SPACE</b> to continue.</p>", {next:"calibration"}));

  // Cali chunk 2
  timeline.push(...buildMetaEmotionCalibrationChunk(metaState, CALI_CHUNK, 2));

  // MRT chunk 2
    timeline.push(audioUnlockTrial());
  timeline.push(...buildMRTChunk({ jsPsych, subjectID, metronomeAudio, _state: sharedState, includeMidBreak: false, blocksToTake: MRT_BLOCKS_PER_CHUNK }).timeline);

  timeline.push(transitionScreen("<p><b>Meta-Emotion Calibration</b></p><p>Press <b>SPACE</b> to continue.</p>", {next:"calibration"}));

  // Cali chunk 3 (remainder) - just take another chunk; repeat as needed
  timeline.push(...buildMetaEmotionCalibrationChunk(metaState, CALI_CHUNK, 3));

  // MRT chunk 3
    timeline.push(audioUnlockTrial());
  timeline.push(...buildMRTChunk({ jsPsych, subjectID, metronomeAudio, _state: sharedState, includeMidBreak: false, blocksToTake: MRT_BLOCKS_PER_CHUNK }).timeline);

  // Finish remaining calibration (if any)
  while (metaState.caliCursor < metaState.calibrationPairs.length) {
    timeline.push(transitionScreen("<p><b>Meta-Emotion Calibration</b></p><p>Press <b>SPACE</b> to continue.</p>", {next:"calibration"}));

    timeline.push(...buildMetaEmotionCalibrationChunk(metaState, CALI_CHUNK, Math.floor(metaState.caliCursor / CALI_CHUNK) + 4));
      timeline.push(audioUnlockTrial());
  timeline.push(...buildMRTChunk({ jsPsych, subjectID, metronomeAudio, _state: sharedState, includeMidBreak: false, blocksToTake: MRT_BLOCKS_PER_CHUNK }).timeline);
    // stop if MRT blocks run out; you can also break once you hit 30min worth
    if (sharedState.mrtCursor >= 35) break;
  }

  // Meta-Emotion review + metaJ
  timeline.push(...buildMetaEmotionReview(metaState, 20));
  timeline.push(...buildMetaEmotionMetaJ(metaState, 60));

  // End screen
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `<div class="center" style="font-size:24px;">Done. Saving...</div>`,
    choices: "NO_KEYS",
    trial_duration: 1000,
    data: {task:"system", event:"end"}
  });

  jsPsych.run(timeline);
}

start();
