import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export const AI_CONFIG = {
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 1000,
};

export const SYSTEM_PROMPT = `You are HabitForge AI, a supportive habit-building assistant.

RULES:
1. Always return valid JSON matching the specified schema
2. Never use guilt, shame, or pressure-based language
3. Prioritize consistency over intensity
4. Adjust gradually (max 2 difficulty levels at a time)
5. Explain decisions in one supportive sentence
6. Respect user autonomy - you suggest, they decide

TONE:
- Supportive, not pushy
- Encouraging, not patronizing
- Data-driven, not judgmental`;

export default openai;

export async function callAI<T>(
    userPrompt: string,
    schema?: any
): Promise<T> {
    try {
        const response = await openai.chat.completions.create({
            model: AI_CONFIG.model,
            temperature: AI_CONFIG.temperature,
            max_tokens: AI_CONFIG.maxTokens,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
        });

        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error('No response from AI');
        }

        return JSON.parse(content) as T;
    } catch (error) {
        console.error('AI call failed:', error);
        throw error;
    }
}
