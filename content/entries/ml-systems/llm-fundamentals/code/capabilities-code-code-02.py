# Chain-of-Thought prompting for reasoning
def chain_of_thought_prompt(problem):
    """Structure prompts to encourage step-by-step reasoning"""

    prompt = f"""
Solve this problem step by step:

Problem: {problem}

Let me think through this carefully:

Step 1: Understand what we're asked to find
Step 2: Identify the relevant information
Step 3: Apply appropriate methods/formulas
Step 4: Calculate the result
Step 5: Verify the answer

Solution:
"""
    return prompt

# Few-shot reasoning examples
def few_shot_reasoning_prompt(problem):
    """Provide examples of reasoning before the actual problem"""

    prompt = f"""
Here are examples of step-by-step problem solving:

Example 1:
Problem: If a train travels 120 miles in 2 hours, what is its speed?
Solution:
Step 1: We need to find speed
Step 2: Distance = 120 miles, Time = 2 hours
Step 3: Speed = Distance / Time
Step 4: Speed = 120 / 2 = 60 mph
Step 5: Check: 60 mph × 2 hours = 120 miles ✓

Example 2:
Problem: A rectangle has length 8 and width 5. What is its area?
Solution:
Step 1: We need to find area of rectangle
Step 2: Length = 8, Width = 5
Step 3: Area = Length × Width
Step 4: Area = 8 × 5 = 40
Step 5: Check: 40 square units is reasonable ✓

Now solve this problem:
Problem: {problem}
Solution:
"""
    return prompt

# Tool-augmented reasoning
class ReasoningWithTools:
    def __init__(self, model, tools):
        self.model = model
        self.tools = tools

    def solve_with_tools(self, problem):
        """Use external tools for complex reasoning"""

        # Step 1: Plan approach
        plan_prompt = f"How should I solve this problem? What tools might I need? Problem: {problem}"
        plan = self.model.generate(plan_prompt)

        # Step 2: Execute plan with tools
        if "calculator" in plan.lower():
            result = self.tools["calculator"](problem)
        elif "search" in plan.lower():
            result = self.tools["search"](problem)
        elif "code" in plan.lower():
            result = self.tools["code_interpreter"](problem)

        # Step 3: Synthesize final answer
        synthesis_prompt = f"""
Problem: {problem}
Tool result: {result}
Please provide a clear, complete answer based on this information.
"""
        final_answer = self.model.generate(synthesis_prompt)
        return final_answer
