import { useEffect, useState } from "./component.js"

export default function useConfig() {
  const [config, setConfig] = useState(null)

  useEffect(() => {
    async function updateConfig() {
      const res = await fetch(`/config`)
      if (res.ok) {
        try {
          const newConfig = await res.json()
          setConfig(newConfig)
        } catch (e) {
          console.error(e)
          setTimeout(updateConfig, 3000)
        }
      } else {
        setTimeout(updateConfig, 3000)
      }
    }
    updateConfig()
  }, [])

  return config
}
