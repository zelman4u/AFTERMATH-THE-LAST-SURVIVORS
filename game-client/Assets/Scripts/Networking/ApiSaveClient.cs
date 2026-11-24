using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

namespace Aftermath.Networking
{
    public class ApiSaveClient : MonoBehaviour
    {
        [Tooltip("Base URL of the AFTERMATH Express + MongoDB backend server")]
        public string apiBaseUrl = "http://localhost:3000/api";
        public string guestOrUidHeader = "guest_unity_client";
        public string firebaseBearerToken = "";

        public IEnumerator FetchWorldConfig(System.Action<string> onSuccess)
        {
            using UnityWebRequest req = UnityWebRequest.Get($"{apiBaseUrl}/world/config");
            yield return req.SendWebRequest();
            if (req.result == UnityWebRequest.Result.Success)
            {
                onSuccess?.Invoke(req.downloadHandler.text);
            }
        }

        public IEnumerator UploadSaveSlot(string slotId, string saveJson)
        {
            byte[] body = Encoding.UTF8.GetBytes($"{{\"save\":{saveJson},\"reason\":\"manual\",\"syncSource\":\"unity\"}}");
            using UnityWebRequest req = new UnityWebRequest($"{apiBaseUrl}/saves/{slotId}", "PUT");
            req.uploadHandler = new UploadHandlerRaw(body);
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("x-guest-id", guestOrUidHeader);
            if (!string.IsNullOrEmpty(firebaseBearerToken))
            {
                req.SetRequestHeader("Authorization", $"Bearer {firebaseBearerToken}");
            }
            yield return req.SendWebRequest();
        }
    }
}
