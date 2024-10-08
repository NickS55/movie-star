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
  const [overlayInProgress, setOverlayInProgress] = useState<boolean>(false)
  const [error, setError] = useState<string | undefined>()

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
    try {
      const ffmpeg = ffmpegRef.current;
      await ffmpeg.writeFile("input", await fetchFile(videoFile));
      await ffmpeg.writeFile("input2", await fetchFile(video2File));
      console.log(currentTimes.current)
      await ffmpeg.exec([
        "-ss", `${currentTimes.current?.[0]}`,
        "-i", "input",
        "-t", "2",
        "-c:v", "libvpx",
        "-an",
        "-crf", "5",
        "-threads", "0",
        "output1.webm",
      ]);
      console.log("video1 conversion complete")
      await ffmpeg.exec([
        "-ss", `${currentTimes.current?.[1]}`,
        "-i", "input2",
        "-t", "2",
        "-c:v", "libvpx",
        "-an",
        "-crf", "5",
        "-threads", "0",
        "output2.webm",
      ]);
      console.log("video2 conversion complete")
      await ffmpeg.exec([
        '-i',
        'output1.webm',
        '-i',
        'output2.webm',
        '-an',
        '-filter_complex',
        // '[0:v][1:v]blend=all_expr=\'A*0.5 + B*0.5\'',
        "[0:v][1:v]blend=all_expr='if(gt(A,175), A, B)'",
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
    } catch (e: any) {
      setError(e)
    }
    setOverlayInProgress(false)
  };

  const handleButtonClick = () => {
    if (!!videoFile && !!video2File) {
      setOverlayInProgress(true)
      const video1 = document.getElementById("video1") as HTMLVideoElement;
      const video2 = document.getElementById("video2") as HTMLVideoElement;

      // play and pause video so currentTime is avaliable
      video1.play()
      video1.pause()
      video2.play()
      video2.pause()

      currentTimes.current = [video1?.currentTime, video2?.currentTime]
      transcode()
    }
  }

  return loaded ? (
    <div className='bg-green-800 py-8 flex flex-col gap-8'>
      <div className='flex flex-col md:flex-row justify-center gap-8'>
        {/* todo:
        1) add the ability to move by one frame at a time
        2) add error
        3) add progress indicator */}
        <div className=' w-full md:w-5/12'>
          <label className="text-white text-3xl text-center w-full block">Video 1</label>
          <video
            className='w-full'
            src={!!videoFile ? URL.createObjectURL(videoFile) : ''}
            poster={!videoFile ? 'VIDEO.png' : ''}
            id="video1"
            controls></video>
          <input type="file" accept="video/*" name="video" onChange={handleFileUpload} />
        </div>
        <div className='w-full md:w-5/12'>
          <label className="text-white text-3xl text-center w-full block">Video 2</label>
          <video className='w-full'
            src={!!video2File ? URL.createObjectURL(video2File) : ''}
            poster={!video2File ? 'VIDEO.png' : ''}
            id="video2"
            controls></video>
          <input type="file" accept="video/*" name="video" onChange={handleFile2Upload} />
        </div>
      </div>
      <div className="flex flex-row justify-center ">
        <button className="bg-amber-50 disabled:bg-gray-300 rounded p-4 font-bold text-xl" onClick={handleButtonClick} disabled={overlayInProgress}>Create Pitching Overlay Video</button>
      </div>
      <div className="flex flex-row justify-center">
        <video className='w-full md:w-8/12' ref={videoRef} controls></video>
      </div>
      <br />
      <p ref={messageRef}></p>
      <div>Error: {error}</div>
    </div>
  ) : (
    // change to <Suspense> 
    <h3> Please Wait... Content Is Loading... </h3>
  );
}

export default App;