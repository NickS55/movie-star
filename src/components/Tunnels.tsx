import { useState, useRef, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

function App() {
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";
    const ffmpeg = ffmpegRef.current;

    // Log messages from ffmpeg
    ffmpeg.on("log", ({ message }) => {
      if (messageRef.current) {
        messageRef.current.innerHTML = message;
      }
    });

    // Convert URLs to Blob URLs to bypass CORS issues
    const loadCoreURL = toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript");
    const loadWasmURL = toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm");
    const loadWorkerURL = toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript");

    Promise.all([loadCoreURL, loadWasmURL, loadWorkerURL])
      .then(([coreURL, wasmURL, workerURL]) => {
        // Load ffmpeg with the provided URLs
        return ffmpeg.load({ coreURL, wasmURL, workerURL });
      })
      .then(() => {
        setLoaded(true);
        console.log("FFmpeg loaded successfully.");
      })
      .catch((error) => {
        console.error("Error during FFmpeg loading process:", error);
      });
  };

  useEffect(() => {
    load()
  }, [])

  const [videoFile, setVideoFile] = useState<File | undefined>()
  const [video2File, setVideo2File] = useState<File | undefined>()
  const currentTimes = useRef<number[]>([])
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const messageRef = useRef<HTMLParagraphElement | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoFile(e.target.files?.[0])
  }
  const handleFile2Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideo2File(e.target.files?.[0])
  }
  const transcode = async () => {
    const ffmpeg = ffmpegRef.current;
    await ffmpeg.writeFile("input", await fetchFile(videoFile));
    await ffmpeg.writeFile("input2", await fetchFile(video2File));
    console.log(currentTimes.current)
    await ffmpeg.exec([
      "-ss", `${currentTimes.current?.[0]}`,
      "-i", "input",
      "-t", "1",
      "-c:v", "libvpx",
      "-an",
      "-crf", "10",
      "-threads", "0",
      "output1.webm",
    ]);
    console.log("video1 conversion complete")
    await ffmpeg.exec([
      "-ss", `${currentTimes.current?.[1]}`,
      "-i", "input2",
      "-t", "1",
      "-c:v", "libvpx",
      "-an",
      "-crf", "10",
      "-threads", "0",
      "output2.webm",
    ]);
    console.log("video2 conversion complete")
    await ffmpeg.exec([
      '-i',
      'output1.webm',
      '-i',
      'output2.webm',
      '-filter_complex',
      '[0:v][1:v]blend=all_expr=\'A*0.5 + B*0.5\'',
      'output.mp4',
    ]);
    console.log("video creation complete")
    const fileData = await ffmpeg.readFile('output.mp4');
    const data = new Uint8Array(fileData as unknown as ArrayBuffer);
    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(
        new Blob([data.buffer], { type: 'video/mp4' })
      )
    }
  };

  const handleButtonClick = () => {
    const video1 = document.getElementById("video1") as HTMLVideoElement;
    const video2 = document.getElementById("video2") as HTMLVideoElement;

    // play and pause video so currentTime is avaliable
    video1.play()
    video1.pause()
    video2.play()
    video2.pause()

    currentTimes.current = [video1?.currentTime, video2?.currentTime]
    console.log({video: video1})
    transcode()
  }

  return loaded ? (
    <>
      {!!videoFile && <video src={URL.createObjectURL(videoFile)} id="video1" controls></video>}
      {!!video2File && <video src={URL.createObjectURL(video2File)} id="video2" controls></video>}
      <video ref={videoRef} controls></video>
      <br />
      <form>
        <input type="file" accept="video/*" name="video" onChange={handleFileUpload} />
        <input type="file" accept="video/*" name="video" onChange={handleFile2Upload} />
      </form>
      <button onClick={handleButtonClick}>Transcode avi to mp4</button>
      <p ref={messageRef}></p>
    </>
  ) : (
    // change to <Suspense> 
    <h3> Loading ... </h3>
  );
}

export default App;