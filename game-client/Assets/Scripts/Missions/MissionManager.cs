using System.Collections.Generic;
using UnityEngine;

namespace Aftermath.Missions
{
    public class MissionManager : MonoBehaviour
    {
        public int activeChapterIndex = 1;
        public List<string> completedChapterIds = new List<string>();

        public void CompleteChapter(string chapterId)
        {
            if (!completedChapterIds.Contains(chapterId))
            {
                completedChapterIds.Add(chapterId);
                activeChapterIndex = Mathf.Min(7, completedChapterIds.Count + 1);
            }
        }
    }
}
