import { createWorkflow } from './sdk';
import { saveUserStep } from './steps';

export const registerFlow = createWorkflow('register', (input: { name: string }) => {
  void saveUserStep(input);
});
