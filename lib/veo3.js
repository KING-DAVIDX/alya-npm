const axios = require('axios');
const crypto = require('crypto');
const { validateParameters } = require('./utils');

async function veo3(prompt, { model = 'veo-3-fast', auto_sound = false, auto_speech = false } = {}) {
  try {
    // Validate parameters using the utility function
    validateParameters({
      prompt: { value: prompt, required: true, type: 'string' },
      model: { value: model, options: ['veo-3-fast', 'veo-3'] },
      auto_sound: { value: auto_sound, type: 'boolean' },
      auto_speech: { value: auto_speech, type: 'boolean' }
    });

    const { data: cf } = await axios.get('https://api.nekorinn.my.id/tools/rynn-stuff', {
      params: {
        mode: 'turnstile-min',
        siteKey: '0x4AAAAAAANuFg_hYO9YJZqo',
        url: 'https://aivideogenerator.me/features/g-ai-video-generator',
        accessKey: 'e2ddc8d3ce8a8fceb9943e60e722018cb23523499b9ac14a8823242e689eefed'
      }
    });

    const uid = crypto.createHash('md5').update(Date.now().toString()).digest('hex');
    const { data: task } = await axios.post('https://aiarticle.erweima.ai/api/v1/secondary-page/api/create', {
      prompt: prompt,
      imgUrls: [],
      quality: '720p',
      duration: 15,
      autoSoundFlag: auto_sound,
      soundPrompt: '',
      autoSpeechFlag: auto_speech,
      speechPrompt: '',
      speakerId: 'Auto',
      aspectRatio: '16:9',
      secondaryPageId: 1811,
      channel: 'VEO3',
      source: 'aivideogenerator.me',
      type: 'features',
      watermarkFlag: true,
      privateFlag: true,
      isTemp: true,
      vipFlag: true,
      model: model
    }, {
      headers: {
        uniqueid: uid,
        verify: cf.result.token
      }
    });

    while (true) {
      const { data } = await axios.get(`https://aiarticle.erweima.ai/api/v1/secondary-page/api/${task.data.recordId}`, {
        headers: {
          uniqueid: uid,
          verify: cf.result.token
        }
      });

      if (data.data.state === 'success') return JSON.parse(data.data.completeData);
      await new Promise(res => setTimeout(res, 1000));
    }
  } catch (error) {
    throw new Error(`veo3 Error: ${error.message}`);
  }
}

module.exports = veo3;