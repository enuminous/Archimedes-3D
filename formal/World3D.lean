import Mathlib

namespace World3D
noncomputable section

/-- Cell spacings are 24/16, 10/6, 18/12, from world3d/MATHEMATICS.md. -/
def wx (κ : ℝ) : ℝ := (1/10) * κ / (3/2 : ℝ)^2
def wy (κ : ℝ) : ℝ := (1/10) * κ / (5/3 : ℝ)^2
def wz (κ : ℝ) : ℝ := wx κ
def centerWeight (κ : ℝ) : ℝ := 1 - 2 * (wx κ + wy κ + wz κ) - 0.0055

theorem weights_nonnegative (κ : ℝ) (hκ : κ ∈ Set.Icc 0 1) :
    0 ≤ wx κ ∧ 0 ≤ wy κ ∧ 0 ≤ wz κ ∧ 0 ≤ centerWeight κ := by
  have hκ0 := hκ.1
  dsimp [wx, wy, wz, centerWeight]
  constructor
  · positivity
  constructor
  · positivity
  constructor
  · positivity
  · norm_num
    linarith [hκ.1, hκ.2]

theorem weight_sum (κ : ℝ) : centerWeight κ + 2 * (wx κ + wy κ + wz κ) = 0.9945 := by
  unfold centerWeight
  ring

theorem source_free_step_nonnegative (κ c xp xm yp ym zp zm : ℝ)
    (hκ : κ ∈ Set.Icc 0 1) (hc : 0 ≤ c)
    (hx : 0 ≤ xp ∧ 0 ≤ xm) (hy : 0 ≤ yp ∧ 0 ≤ ym) (hz : 0 ≤ zp ∧ 0 ≤ zm) :
    0 ≤ centerWeight κ * c + wx κ * (xp+xm) + wy κ * (yp+ym) + wz κ * (zp+zm) := by
  obtain ⟨ha,hb,hd,he⟩ := weights_nonnegative κ hκ
  rcases hx with ⟨hxp,hxm⟩
  rcases hy with ⟨hyp,hym⟩
  rcases hz with ⟨hzp,hzm⟩
  positivity

theorem uniform_field_decay (κ c : ℝ) :
    centerWeight κ * c + wx κ * (c+c) + wy κ * (c+c) + wz κ * (c+c) = 0.9945*c := by
  linear_combination c * weight_sum κ

theorem bounded_step (κ c xp xm yp ym zp zm : ℝ)
    (hκ : κ ∈ Set.Icc 0 1) (hc : c ∈ Set.Icc 0 1)
    (hx : xp ∈ Set.Icc 0 1 ∧ xm ∈ Set.Icc 0 1)
    (hy : yp ∈ Set.Icc 0 1 ∧ ym ∈ Set.Icc 0 1)
    (hz : zp ∈ Set.Icc 0 1 ∧ zm ∈ Set.Icc 0 1) :
    centerWeight κ * c + wx κ * (xp+xm) + wy κ * (yp+ym) + wz κ * (zp+zm) ≤ 0.9945 := by
  obtain ⟨ha,hb,hd,he⟩ := weights_nonnegative κ hκ
  have h0 := mul_le_mul_of_nonneg_left hc.2 he
  have h1 := mul_le_mul_of_nonneg_left (show xp+xm ≤ 2 by linarith [hx.1.2,hx.2.2]) ha
  have h2 := mul_le_mul_of_nonneg_left (show yp+ym ≤ 2 by linarith [hy.1.2,hy.2.2]) hb
  have h3 := mul_le_mul_of_nonneg_left (show zp+zm ≤ 2 by linarith [hz.1.2,hz.2.2]) hd
  linarith [weight_sum κ]

/-- Normal component after the documented coefficient-of-restitution update. -/
theorem rebound_normal (v : ℝ) : v - (1 + (0.55 : ℝ)) * v = -0.55*v := by ring

theorem rebound_dissipates_normal_energy (v : ℝ) : (-0.55*v)^2 ≤ v^2 := by
  nlinarith [sq_nonneg v]

theorem maximum_planner_ticks : (4 + 4 * 4 * (4-1)) * 40 = (2080 : ℕ) := by decide +kernel

end World3D
